sap.ui.define([
	'sap/ui/core/mvc/Controller',
	'sap/ui/model/json/JSONModel',
	'd100adj_ui/myLib/oData',
	'd100adj_ui/myLib/utils',
	'sap/m/MessageToast',
	"sap/m/MessageBox",
	"sap/m/Dialog"
], function (Controller, JSONModel, oData, utils, MessageToast, MessageBox, Dialog) {
	"use strict";

	return Controller.extend("d100adj_ui.Page", {

		onPress: function () {
			var dateReg = /^\d{2}([./-])\d{2}\1\d{4}$/;
			var view = this.getView();
			if (oData.SelectedCompany == 0 || oData.SelectedBranch == 0 || oData.SelectedBranch2 == 0) {
				MessageBox.warning("Campo obrigatório sem preenchimento ou inválido");
				return;
			}
			if (oData.SelectedBranch > oData.SelectedBranch2) {
				MessageBox.warning("Valor inicial do range de estabelecimento maior que o final!");
				return;
			}
			if(!oData.SelectedPeriod.match(dateReg)){
				console.log(oData.SelectedPeriod)
				MessageBox.warning("Formato de período incorreto, use o seletor para definir o período");
				return;
			}
			if (oData.CSV.length < 1) {
				MessageBox.warning("Faça primeiro o upload do arquivo CSV!");
				return;
			}

			for (let csv_row of oData.CSV) {
				if (!csv_row.chave || !csv_row.remetente || !csv_row.destinatario) {
					MessageBox.warning(`Formato de arquivo incorreto`);
					return;
				}
				if (csv_row.chave.length !== 44) {
					MessageBox.warning(`ERROR: Chave tamanho incorreto: ${csv_row.chave}`);
					return;
				}
				if (csv_row.remetente.length !== 7) {
					MessageBox.warning(`ERROR: Codigo de municipio tamanho incorreto: ${csv_row.remetente}`);
					return;
				}
				if (csv_row.destinatario.length !== 7) {
					MessageBox.warning(`ERROR: Codigo de municipio tamanho incorreto: ${csv_row.remetente}`);
					return;
				}
			}

			oData.Results = [];
			var oModel = new JSONModel(oData);
			view.setModel(oModel);

			var oDialog = this.byId("BusyDialog");
			oDialog.open();

			var company = utils.find(oData.SelectedCompany, oData.CompanyCollection);
			var branch = utils.find(oData.SelectedBranch, oData.BranchCollection);
			var branch2 = utils.find(oData.SelectedBranch2, oData.BranchCollection2);

			var xhttp = new XMLHttpRequest();
			xhttp.open("POST", "/d100/change", true);
			xhttp.setRequestHeader('content-type', 'application/json');
	console.log("simulation:",oData.Simulation);
			var content = {
				simulation: oData.Simulation,
				company: company,
				branch: branch,
				branch2: branch2,
				period: oData.SelectedPeriod,
				csv: oData.CSV
			};
			xhttp.send(JSON.stringify(content));
			var msg = '';
			var that = this;
			xhttp.onreadystatechange = function () {
				if (this.readyState === 4 && this.status === 200) {
					var response = JSON.parse(this.responseText);
					oDialog.close();

					var oTableCte = that.byId("tableCte");

					var t = 0;
					while (t < response.result.length) {
						if (response.result[t].STATUS && oData.Simulation) response.result[t].STATUS = 'Simulado';
						if (response.result[t].STATUS && !oData.Simulation) response.result[t].STATUS = 'Processado';
						if (!response.result[t].STATUS) response.result[t].STATUS = '';
						t++;
					}

					oTableCte.setModel(new JSONModel({
						CTE: response.result
					}));

				
					if (response.result.length > 0) {
						msg = 'Processado com sucesso!!';
						oDialog = that.byId("TableDialog");
					    oDialog.open();
					    oData.Results = response.result;
					    oModel = new JSONModel(oData);
				     	view.setModel(oModel);
					} else {
						msg = 'Nenhum registro encontrado';
					}

			
					MessageToast.show(msg);

				} else {
					oDialog.close();
					if (this.status === 401) {
						window.location.reload();
					} else if (this.readyState === 3 && this.status >= 500) {
						MessageBox.error(this.response);
					}
				}
			};

		},

		changeCompany: function () {
			var allData = this.getView().getModel().getData();

			oData.SelectedBranch = 0;
			oData.SelectedBranch2 = 0;
			oData.BranchCollection = [];
			oData.BranchCollection2 = [];

			oData.BranchCollection = allData.Branchs.filter(function (a) {
				if (a.IdCompany == oData.SelectedCompany || a.Id == 0) {
					return true;
				} else {
					return false;
				}
			});
			oData.BranchCollection2 = oData.BranchCollection;

		},

		handleUploadPress: function (e) {
			var view = this.getView();
			var oFileUploader = this.byId("fileUploader").oFileUpload;
			var file = oFileUploader.files && oFileUploader.files[0];
			if (file && window.FileReader) {
				var reader = new FileReader();
				reader.onload = function (evn) {

				};
				reader.onloadend = function (evn) {
					var strCSV = evn.target.result; //string in CSV 
					if (strCSV) {
						var fileJs = strCSV.split("\n");
						oData.CSV = [];
						for (var i = 0; i < fileJs.length; i++) {
							if (i > 0) {
								var line = fileJs[i].split(';');
								if (line[0] && line[0] !== '') {
									oData.CSV.push({
										chave: line[0]?.replace('\r', ''),
										remetente: line[1]?.replace('\r', ''),
										destinatario: line[2]?.replace('\r', '')
									});
								}
							}
						}

						var oModel = new JSONModel(oData);
						view.setModel(oModel);
					}
				}

				reader.readAsText(file);
			}
		},
		onClose: function (e) {
			var oDialog = this.byId("TableDialog");
			oDialog.close();
		}

	});

});