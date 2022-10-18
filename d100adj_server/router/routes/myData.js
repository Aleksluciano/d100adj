/*eslint no-console: 0, no-unused-vars: 0, no-shadow: 0, new-cap: 0*/
/*eslint-env node, es6 */
"use strict";
var express = require("express");

module.exports = () => {
	var app = express.Router();

	//HANA DB Client 
	app.get("/", (req, res) => {

		let client = req.db;

		client.exec(
			`select 
b."EMPRESA",
b."ESTABELECIMENTO"
 from "adejo.view::/TMF/V_EMP_FED" as a JOIN "adejo.table::/TMF/D_ESTABELEC" as b on a.EMPRESA = b.EMPRESA WHERE EH_MATRIZ = 'X'
 order by "EMPRESA","ESTABELECIMENTO"`,
			(err, result) => {
				if (err) {
					return res.type("text/plain").status(500).send(`ERROR: ${err.toString()}`);
				} else {

					let IdCompany = 0;
					let IdBranch = 0;
					let group = {
						CompanyCollection: [{
							Id: 0,
							Name: ""
						}],
						BranchCollection: [{
							Id: 0,
							Name: ""
						}]
					};
					let Company = "";

					result.forEach((a) => {
						if (a.EMPRESA !== Company) {
							IdCompany++;
							Company = a.EMPRESA;
							IdBranch = 0;
							group.CompanyCollection.push({
								Id: IdCompany,
								Name: a.EMPRESA
							});
						}
						IdBranch++;
						group.BranchCollection.push({
							IdCompany: IdCompany,
							Id: IdBranch,
							Name: a.ESTABELECIMENTO
						});

					});

			
					return res.type("application/json").status(200).send({
						emp: group.CompanyCollection,
						estab: group.BranchCollection
					});
				}
			});

	});
	return app;
};