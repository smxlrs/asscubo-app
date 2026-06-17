
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

function setCreditCard(cardNumber, cardMonth, cardYear, firstName, lastName) {
	var e = document.getElementById("cardnumber");
	if (e) e.value = cardNumber;
	var e = document.getElementById("expmonth");
	if (e) e.value = cardMonth-1;
	var e = document.getElementById("expyear");
	if (e) {
        for (i=0; i<e.length; i++)
            if (e.options[i].innerHTML == cardYear)
                e.selectedIndex=i;
    }
	freeForm();
}