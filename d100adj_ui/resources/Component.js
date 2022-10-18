sap.ui.define(['sap/ui/core/UIComponent',
		'sap/ui/model/json/JSONModel',
		'd100adj_ui/myLib/oData',
		'd100adj_ui/myLib/utils',
		'sap/m/MessageBox'
	],
	function (UIComponent, JSONModel, oData, utils, MessageBox) {
		"use strict";
		const newoData = utils.deepClone(oData);

		return UIComponent.extend("d100adj_ui.Component", {

			metadata: {
				manifest: "json"
			},

			init: function () {
				UIComponent.prototype.init.apply(this, arguments);
				sap.ui.getCore().getConfiguration().setLanguage("pt-BR");
				jQuery.sap.includeStyleSheet("css/style.css");

				var xhttp = new XMLHttpRequest();
				var view = this;

				oData.Simulation = true;
				oData.StateList = {
					highlight: "Success",
					info: "Processado"
				};
				oData.CSV = [];
				oData.Results = [];
				oData.Companies = [];
				oData.Branchs = [];
				oData.SelectedCompany = 0;
				oData.SelectedBranch = 0;
				oData.SelectedBranch2 = 0;
				oData.SelectedPeriod = newoData.SelectedPeriod;
				oData.CompanyCollection = [];
				oData.BranchCollection = [];

				xhttp.open("GET", '/d100/data', true);
				xhttp.send();
				xhttp.onreadystatechange = function () {

					if (this.readyState === 4 && this.status === 200) {
						var response = JSON.parse(this.responseText);
						oData.CompanyCollection = response.emp;
						oData.Companies = response.emp;
						oData.BranchCollection = response.estab;
						oData.Branchs = response.estab;
						oData.BranchCollection2 = JSON.parse(JSON.stringify(response.estab));

						var oModel = new JSONModel(oData);
						view.setModel(oModel);

					} else {
						if (this.status === 401) {
							window.location.reload();
						} else if (this.readyState === 3 && this.status >= 500) {
							MessageBox.error(this.response);
						}

					}
				};

				var oModel = new JSONModel(oData);
				this.setModel(oModel);

			}

		});
	});