
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
	/* hide hotel section */
	var e = $('#collapseHotel');
	if (e) e.parent().hide();
}

function injectViewPort() {
    var meta = document.createElement('meta');
    meta.name = "viewport";
    meta.content = "width=device-width, initial-scale=1, maximum-scale=1";
    document.getElementsByTagName('head')[0].appendChild(meta);
}

function _getFareName() {
    var list = [];
    $("input[id^='selectedOfferLabel']").each(function(index){
        var e = $(this);
        if (e.attr('id').indexOf('Text') > 0) {
            list.push(e.val());
        }
    });
    return list.join();

}

function _getEmail() {
    var e = $("input[id^='emailId']");
    return e && e.val() ? e.val() : "";
}

function _getLoyaltyCard() {
    var e = $("input[id^='loyaltyCode_']");
    return e && e.val().length > 0;
}

function _getInvoice() {
    var e = document.getElementById("sifatt");
    return e && e.checked;
}

function _getPayMethod() {
    var v = $('input[name=paymentMode]:checked').val();
    return v ? v : "unknown";
}

function addPurchaseHook() {
    var e = $('#submitMyTrip');
    if (e) {
        var onclick = e.attr("onclick");
        e.attr("onclick", "orariotreni.setLoyaltyCard(_getLoyaltyCard()); orariotreni.setInvoice(_getInvoice());  orariotreni.setPayMethod(_getPayMethod()); orariotreni.setEmail(_getEmail());"+onclick);
    }
}

function addFaresHook() {
    var e = $('#next_page_after_login input[type=submit]');
    if (e) {
        var onclick = e.attr("onclick");
        e.attr("onclick", "orariotreni.setFare(_getFareName());"+onclick);
    }
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

function setVATNumber(vat) {
	var old = handlingShowInvoiceAjaxResponse;
	handlingShowInvoiceAjaxResponse = function(req, divName) {
		old(req, divName);
		$('#invoice\\.vatNumberSearched').val(vat);
	}
}

function setFidelityCard(card) {
	var e = $("input[id^=loyaltyCode][type=text]").first();
	if (e && e.val().length == 0 && document.getElementById("checkPassenger").checked) {
		e.val(card);
		e.blur();
	}
}

function ot_trim(field) {
    field.value = field.value ? field.value.replace(/\s/g,'') : '';
}

function ot_disableReturnTrip() {
    $(function() { $('#skipCheckReturnTrip').val('true'); });
}

function ot_checkImPassenger() {
    $(function() {
        if (!document.getElementById('checkPassenger').checked) {
            $('#paxDetailDiv0false .panel-heading').addClass('after-loading');
            setTimeout(function() {
                try {
                    $('#checkPassenger').click();
                } finally {
                    $('#paxDetailDiv0false .panel-heading').removeClass('after-loading');
                }
            },200);
        }
    });
}

function ot_fixInputs() {
    $("input[id^='dob_']").removeAttr('onkeypress').removeAttr('onkeyup').removeAttr('onmousedown').removeAttr('onfocus');
    $("input[id^='buoniScontoCode']").on('paste', function(e) {
                                       window.setTimeout(function () { $(e.target).trigger('keyup'); }, 300);
                                     });
    var email = $("#emailId");
    if (email) {
        var onchange = email.attr("onchange");
        email.attr("onchange", "ot_trim(this);"+onchange);
    }
    email = $("#email2Id");
    if (email) {
        var onchange = email.attr("onchange");
        email.attr("onchange", "ot_trim(this);"+onchange);
    }
}

function listenToPassengerRefresh() {
    $(document).ajaxComplete(function (event, request, settings) {
           if (settings.url.indexOf("refreshPassengersSection") > 0) {
                setTimeout(function () { ot_fixInputs(); }, 500);
           }
        });
}

function ot_setFidelityCardFare(card) {
    $("input[id$='|13|TRV']").val(card);
}

function listenToFareChange(card) {
    XMLHttpRequest.prototype.realOpen = XMLHttpRequest.prototype.open;

    var myOpen = function(method, url, async, user, password) {
        if (url.indexOf("parameter=selectOffer") > 0) {
            setTimeout(function () { ot_setFidelityCardFare(card); }, 500);
        }
        this.realOpen (method, url, async, user, password);
    };

    XMLHttpRequest.prototype.open = myOpen ;
}