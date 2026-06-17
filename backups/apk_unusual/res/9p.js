
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
