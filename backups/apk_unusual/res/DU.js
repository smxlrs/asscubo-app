
function getHtml() {
	return document.getElementsByTagName('html')[0].innerHTML;
}

function parse(url) {
	orariotreni.parse(url, getHtml());
}

function injectStyle(style) { 
	var _body = document.getElementsByTagName('head')[0];
	var _style = document.createElement('style');
	var _text = document.createTextNode(style);
	_style.appendChild(_text);
	_body.appendChild(_style);
}

function loadFares() {
	changeRateSelect('1_0_0_0_altre');
}

function setPersonalInfo(name, surname, card) {
	document.dati.iccardcode.value=card; 
	document.dati.nome.value=name;
	document.dati.cognome.value=surname; 
}

function setBuyerInfo(name, surname, email) {
	document.dati.lightfirstname.value = name;
	document.dati.lightlastname.value = surname;
	document.dati.lightemail.value = email;
	document.dati.lightemail1.value = email;
}

function setCardNumber(card) {
	if (document.dati.dispcardnumber)
		document.dati.dispcardnumber.value=card;
}

function setCustomField(id, value) {
	document.getElementById(id).value = value;
}

function selectTrain(det) {
	document.getElementById('sel'+det).click();
	execute();
}

function changeRateTable(id) {
	changeRate(document.getElementById('fprate_'+id),'N');
	orariotreni.showPrice(document.dati.total.value);
}

function changeRateSelect(fare) {
	var select = document.getElementById('morerates_1'); 
	for (i=0;i<select.length;i++) 
		if (select.options[i].value == fare) 
			select.selectedIndex=i; 
	changeRate(select, 'N');
} 

function setAdults(pos) {
	var select = document.getElementById('adu_1');
	select.selectedIndex=pos; 
	changePax(select);
}

function setBoys(pos) {
	var select = document.getElementById('boy_1');
	select.selectedIndex=pos; 
	changePax(select);
}

function changeDelivery(id) {
	document.getElementById(id).checked=true;
}

function changeClass(pos) {
	var select = document.getElementById('fourlevelserviceclass'); 
	if (select) { 
		select.selectedIndex=pos;
		fourLevelServiceClassChange(false);
	} else { 
		select = document.getElementById('classe');  
		select.selectedIndex=pos;
		classChange();
	}  
	orariotreni.showPrice(dati.total.value);
}

function setCreditCard(cardType, cardNumber, cardMonth, cardYear, firstName, lastName) {
	if (document.DatiCarta) { 
		document.DatiCarta.meseScadenza.selectedIndex=cardMonth-1; 
		for (i=0; i<document.DatiCarta.annoScadenza.length; i++) 
			if (document.DatiCarta.annoScadenza.options[i].value == cardYear)
				document.DatiCarta.annoScadenza.selectedIndex=i; 
		for (i=0; i<document.DatiCarta.tipoCarta.length; i++) 
			if (document.DatiCarta.tipoCarta.options[i].value == cardType) 
				document.DatiCarta.tipoCarta.selectedIndex=i; 
		document.DatiCarta.pan.value=cardNumber; 
		document.DatiCarta.nomeTitolareTrenItalia.value = firstName; 
		document.DatiCarta.cognomeTitolareTrenItalia.value = lastName; 
	} 
	swapImageCard();
}


function setCreditCardNew(cardNumber, cardMonth, cardYear, firstName, lastName) {
	if (document.command) {
		document.command.EXPDT_MM.selectedIndex=cardMonth;
		for (i=0; i<document.command.EXPDT_YY.length; i++)
			if (document.command.EXPDT_YY.options[i].value == cardYear)
				document.command.EXPDT_YY.selectedIndex=i;
		document.command.PAN.value=cardNumber;
		document.command.ACCNTFIRSTNAME.value = firstName;
		document.command.ACCNTLASTNAME.value = lastName;
	}
}
