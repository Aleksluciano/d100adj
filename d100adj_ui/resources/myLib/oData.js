"use strict";
sap.ui.define([], function () {
	"use strict";
	var month = (new Date().getMonth() + 1).toString();
	var year = (new Date().getFullYear()).toString();

	if (month.length < 2) {
		month = '0' + month;
	}
	var date = '01' + '/' + month + '/' + year; 

	return {
		Simulation: true,
		StateList: { 	highlight: "Success",
						info: "Processado"},
		CSV: [],				
		Results: [],
		Companies: [],
		Branchs: [],
		SelectedCompany: 0,
		SelectedBranch: 0,
		SelectedBranch2: 0,
		SelectedPeriod: date,
		CompanyCollection: [],
		BranchCollection: []
	};
});