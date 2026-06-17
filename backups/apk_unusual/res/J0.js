function login(user, pwd) {
    $('#UserName').val(user);
    $('#Password').val(pwd);
   /* $('#ReturnUrl').val("aHR0cDovL3N0b3JlLnRyZW5vcmQuaXQvY2FydA=="); /* http://store.trenord.it/cart */
    $('form').first().submit();
}

function ot_setEmail(email) {
    _setEmail(email);
    listenToPriceChange(email);
}

function _setEmail(email) {
    $('#AnonymousEMail').val(email);
    $('#AnonymousEMailConfirm').val(email);
}

function listenToPriceChange(email) {
     $(document).ajaxComplete(function (event, request, settings) {
           if (settings.url.indexOf("WorkFlowStart") > 0 || settings.url.indexOf("WorkFlowPriceRequest") > 0) {
                setTimeout(function () { _setEmail(email); }, 500);
           }
        });
}

function injectViewPort() {
    var meta = document.createElement('meta');
    meta.name = "viewport";
    meta.content = "width=device-width, initial-scale=1, maximum-scale=1";
    document.getElementsByTagName('head')[0].appendChild(meta);
}

function setPaypal(user, pass) {
	var e = document.getElementById('email');
	if (e) e.value = user;
	e = document.getElementById('password');
	if (e) e.value = pass;
	e = document.getElementById('login');
	if (e) e.disabled = false;

	 try {
            var $body = angular.element(document.body);
            var $rootScope = $body.injector().get('$rootScope');
            $rootScope.$apply(function () {
                   var cancel = $rootScope.$on("allLoaded", function() {
                            cancel();
                            $("#preloaderSpinner").hide();
                            console.log('setPaypal');
                            var iframe = document.querySelector("#injectedUnifiedLogin iframe");
                            if (iframe) {
                                  console.log('iframe');
                                  e = iframe.contentDocument.getElementById("email");
                                  if (e) e.value = user;
                                  e = iframe.contentDocument.getElementById("password");
                                  if (e) e.value = pass;
                            }
                        });
              });
        } catch(error) {
           console.log(error)
        }
}

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

function changeQuantity(id, n) {
	document.getElementById(id).selectedIndex = n;	
	$('#'+id).change();
}

function __doPostBack(eventTarget, eventArgument) {
	var theForm = document.forms['RunwayMasterForm'];
	if (!theForm) {
	    theForm = document.RunwayMasterForm;
	}
    if (!theForm.onsubmit || (theForm.onsubmit() != false)) {
        $('#__EVENTTARGET').val(eventTarget);
        $('#__EVENTARGUMENT').val(eventArgument);
        theForm.submit();
    }
}

function setPhone(num) {
    var e = $("#SmsNumber");
    if (e) {
        e.val(num);
        e.blur();
    }
}

function setCreditCard(cardType, cardNumber, cardMonth, cardYear, firstName, lastName, email) {
	if (document.DatiCarta) { 
		document.DatiCarta.meseScadenza.selectedIndex=cardMonth-1; 
		for (i=0; i<document.DatiCarta.annoScadenza.length; i++) 
			if (document.DatiCarta.annoScadenza.options[i].value == cardYear)
				document.DatiCarta.annoScadenza.selectedIndex=i; 
		for (i=0; i<document.DatiCarta.tipoCarta.length; i++) 
			if (document.DatiCarta.tipoCarta.options[i].value == cardType) {
				document.DatiCarta.tipoCarta.selectedIndex=i;
				break;
            }
		document.DatiCarta.pan.value = cardNumber; 
		document.DatiCarta.titolare.value = firstName + ' ' + lastName; 
		document.DatiCarta.usermail.value = email;
	} 
	swapImageCard();
}