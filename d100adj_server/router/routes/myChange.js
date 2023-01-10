/*eslint no-console: 0, no-unused-vars: 0, no-shadow: 0, new-cap: 0*/
/*eslint-env node, es6 */
"use strict";
var express = require("express");

function pad(n) {
	return n < 10 ? '0' + n : n;
}

module.exports = () => {
	var app = express.Router();

	//HANA DB Client 
	app.post("/", async (req, res) => {

		const {
			company,
			branch,
			branch2,
			period,
			simulation,
			csv
		} = req.body;
		const period1 = period.slice(6) + period.slice(3, 5) + '01';
		const newdate = new Date(period.slice(6), parseInt(period.slice(3, 5)), 0);
		const period2 = period.slice(6) + period.slice(3, 5) + newdate.getDate().toString();

		//validações
		if (!company) return res.type("text/plain").status(500).send(`ERROR: Filtro de empresa faltando`);
		if (!branch) return res.type("text/plain").status(500).send(`ERROR: Filtro de filial faltando`);
		if (!branch2) return res.type("text/plain").status(500).send(`ERROR: Filtro de filial faltando`);
		if (period1.slice(4, 6) !== period2.slice(4, 6)) return res.type("text/plain").status(500).send(
			`ERROR: Filtro de data maior que um mês`);

		for (let csv_row of csv) {
			if (!csv_row.chave || !csv_row.remetente || !csv_row.destinatario) {
				return res.type("text/plain").status(500).send(`ERROR: Formato de arquivo incorreto`);
			}
			if (csv_row.chave.length !== 44) {
				return res.type("text/plain").status(500).send(`ERROR: Chave tamanho incorreto: ${csv_row.chave}`);
			}
			if (csv_row.remetente.length !== 7) {
				return res.type("text/plain").status(500).send(`ERROR: Codigo de municipio tamanho incorreto: ${csv_row.remetente}`);
			}
			if (csv_row.destinatario.length !== 7) {
				return res.type("text/plain").status(500).send(`ERROR: Codigo de municipio tamanho incorreto: ${csv_row.remetente}`);
			}
		}

		let client = req.db;

		const query_select_columns_table =
			`SELECT COLUMN_NAME from TABLE_COLUMNS where SCHEMA_NAME = 'SAPABAP1' and TABLE_NAME = '/TMF/D_NF_DOC'`;
		const query_select_columns_view =
			`SELECT COLUMN_NAME from VIEW_COLUMNS where SCHEMA_NAME = '_SYS_BIC' AND VIEW_NAME = 'sap.glo.tmflocbr.ctr/NF_DOCUMENTO'`;
		const query_select_v_emp_fed = `SELECT "MANDT_TDF" from "adejo.view::/TMF/V_EMP_FED" WHERE EMPRESA = ? AND EH_MATRIZ = 'X'`;
		const query_select_d_nf_doc = `SELECT "MANDT", "NF_ID" FROM "adejo.table::/TMF/D_NF_DOC" WHERE MANDT = ? AND NF_ID = ?`;
		const query_update_d_nf_doc =
			`UPDATE "adejo.table::/TMF/D_NF_DOC" SET COD_MUN_ORIG = ?, COD_MUN_DEST = ? WHERE MANDT = ? AND NF_ID = ?`;

		const resultAll = [];
		let item = 0;

		//SQL EXEC
		try {

			const columns_d_nf_doc = await client.exec(query_select_columns_table);
			const columns_v_nf_doc = await client.exec(query_select_columns_view);

			const arrayColumnValue = [];
			for (const col of columns_d_nf_doc) {
				const col_exist = columns_v_nf_doc.find(a => a.COLUMN_NAME == col.COLUMN_NAME);
				if (col_exist) {
					arrayColumnValue.push(`"${col.COLUMN_NAME}"`);
				}
			}

			if (!arrayColumnValue.includes('"MANDT"') || !arrayColumnValue.includes('"NF_ID"')) throw Error(
				'Columns MANDT or NF_ID not found to insert');
			const columnsjoin = arrayColumnValue.join(', ');

			const query_select_v_nf_doc =
				`SELECT ${columnsjoin} FROM "adejo.view::/TMF/V_NF_DOC" 
WHERE MANDT = ? AND EMPRESA = ? AND FILIAL BETWEEN ? AND ? AND COD_MOD IN ('57', '63', '67' ) AND DT_E_S BETWEEN ? AND ?`;

			let v_emp_fed_table = await client.exec(query_select_v_emp_fed, [company]);
			let v_nf_doc_table = await client.exec(query_select_v_nf_doc, [v_emp_fed_table[0].MANDT_TDF, company, branch, branch2, period1,
				period2
			]);
			if (simulation === true) {
				for (const v_nf_doc of v_nf_doc_table) {
					const csv_line = csv.find(element => element.chave == v_nf_doc.CHV_CTE);
					if (!v_nf_doc.MANDT || !v_nf_doc.NF_ID) continue;
					const update_d_nf_doc = {
						MANDT: v_nf_doc.MANDT,
						NF_ID: v_nf_doc.NF_ID,
						DT_E_S: v_nf_doc.DT_E_S,
						EMPRESA: v_nf_doc.EMPRESA,
						FILIAL: v_nf_doc.FILIAL,
						NUM_DOC: v_nf_doc.NUM_DOC,
						CHV_CTE: v_nf_doc.CHV_CTE,
						COD_MUN_ORIG: v_nf_doc.COD_MUN_ORIG,
						COD_MUN_DEST: v_nf_doc.COD_MUN_DEST,
						COD_MUN_ORIG_NOVO: csv_line ? csv_line.remetente : '',
						COD_MUN_DEST_NOVO: csv_line ? csv_line.destinatario : '',
						STATUS: csv_line ? true : false
					}
					item++;
					resultAll.push({
						... {
							item
						},
						...update_d_nf_doc
					});
				}
			}
			if (simulation === false) {
				for (const v_nf_doc of v_nf_doc_table) {
					const csv_line = csv.find(element => element.chave == v_nf_doc.CHV_CTE);
					if (!v_nf_doc.MANDT || !v_nf_doc.NF_ID) continue;
					const COD_MUN_ORIG = v_nf_doc.COD_MUN_ORIG;
					const COD_MUN_DEST = v_nf_doc.COD_MUN_DEST;

					let d_nf_doc_table = await client.exec(query_select_d_nf_doc, [v_nf_doc.MANDT, v_nf_doc.NF_ID]);

					if (d_nf_doc_table.length > 0) {
						let status = false;
						if (csv_line) {
							v_nf_doc.COD_MUN_ORIG = csv_line.remetente;
							v_nf_doc.COD_MUN_DEST = csv_line.destinatario;
							let d_nf_doc_updated = await client.exec(query_update_d_nf_doc, [v_nf_doc.COD_MUN_ORIG, v_nf_doc.COD_MUN_DEST, v_nf_doc.MANDT,
							v_nf_doc.NF_ID
							]);

							if (d_nf_doc_updated == 1) status = true;
						}
						const update_d_nf_doc = {
							MANDT: v_nf_doc.MANDT,
							NF_ID: v_nf_doc.NF_ID,
							DT_E_S: v_nf_doc.DT_E_S,
							EMPRESA: v_nf_doc.EMPRESA,
							FILIAL: v_nf_doc.FILIAL,
							NUM_DOC: v_nf_doc.NUM_DOC,
							CHV_CTE: v_nf_doc.CHV_CTE,
							COD_MUN_ORIG: COD_MUN_ORIG,
							COD_MUN_DEST: COD_MUN_DEST,
							COD_MUN_ORIG_NOVO: csv_line ? csv_line.remetente : '',
							COD_MUN_DEST_NOVO: csv_line ? csv_line.destinatario : '',
							STATUS: status
						}
						item++;
						resultAll.push({
							... {
								item
							},
							...update_d_nf_doc
						});

					} else {

						let status = false;
						if (csv_line) {

							let columns = '';
							let values = '';
							v_nf_doc.COD_MUN_ORIG = csv_line.remetente;
							v_nf_doc.COD_MUN_DEST = csv_line.destinatario;
							for (const [key, value] of Object.entries(v_nf_doc)) {
								if (value) {
									columns = columns + ` ${key},`;
									values = values + ` '${value}',`;
								}
							}

							columns = columns.slice(0, columns.length - 1);
							values = values.slice(0, values.length - 1);
							const query_insert_d_nf_doc = `INSERT INTO "adejo.table::/TMF/D_NF_DOC" (${columns}) VALUES (${values})`;

							let d_nf_doc_inserted = await client.exec(query_insert_d_nf_doc);
							if (d_nf_doc_inserted == 1) status = true;

						}
						const update_d_nf_doc = {
							MANDT: v_nf_doc.MANDT,
							NF_ID: v_nf_doc.NF_ID,
							DT_E_S: v_nf_doc.DT_E_S,
							EMPRESA: v_nf_doc.EMPRESA,
							FILIAL: v_nf_doc.FILIAL,
							NUM_DOC: v_nf_doc.NUM_DOC,
							CHV_CTE: v_nf_doc.CHV_CTE,
							COD_MUN_ORIG: COD_MUN_ORIG,
							COD_MUN_DEST: COD_MUN_DEST,
							COD_MUN_ORIG_NOVO: csv_line ? csv_line.remetente : '',
							COD_MUN_DEST_NOVO: csv_line ? csv_line.destinatario : '',
							STATUS: status
						}
						item++;
						resultAll.push({
							... {
								item
							},
							...update_d_nf_doc
						});

					}
				}
			}

			return res.type("application/json").status(200).send({
				result: resultAll
			});

		} catch (err) {
			console.log(err)
			return res.type("text/plain").status(500).send(`ERROR: ${err.toString()}`);
		}

	});

	return app;
};