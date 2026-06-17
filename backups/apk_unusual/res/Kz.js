function ot_injectStyle(style) {
	var _body = document.getElementsByTagName('head')[0];
	var _style = document.createElement('style');
	var _text = document.createTextNode(style);
	_style.appendChild(_text);
	_body.appendChild(_style);
}

function ot_setVATNumber(number) {
    document.getElementById('numPartitaIVA').value = number;
}


function ot_setCreditCard(cardType, cardNumber, cardMonth, cardYear, firstName, lastName) {
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


function ot_setCreditCardNew(cardNumber, cardMonth, cardYear, firstName, lastName) {
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

function ot_setPassenger(firstName, lastName, card, email) {
setTimeout(function() {
    if (firstName && firstName.length > 0) {
      $("#passengers input[name='name']").val(firstName);
    }
    if (lastName && lastName.length > 0) {
      $("#passengers input[name='lastname']").val(lastName);
    }
    if (card && card.length > 0) {
      $("#passengers input[name='cartafrecciaID']").val(card);
    }

    if (email && email.length > 0) {
      $("#passengers input[name='email']").val(email);
    }
 }, 500);
}


function ot_setLogin(username, password) {
    setTimeout(function() {
        var el = $("#userID");
        if (el && !el.val().length)
            el.val(username);
        el = $("#password");
        if (el && !el.val().length){
            el.focus();
            el.val(password);
            el.blur();
        }
     }, 500);
}


function ot_installAjaxHook(){
    require(["jquery", "jquery.mobile" ], function ($) {
        $(function(){
            $(document).unbind('ajaxSuccess');
            $(document).ajaxSuccess(function(event, xhr, options, data) {
                if (options.url.indexOf("api/solutions?") !== -1 || options.url.indexOf("api/users/solutions?") !== -1) {
                    orariotreni.onSolutionsLoaded(options.url, JSON.stringify(data));
                }
                if (options.url.indexOf("paymentmodes") !== -1) {
                    orariotreni.onPaymentModesLoaded();
                }
                if (options.url.indexOf("sales/") !== -1 && options.url.indexOf("/order") !== -1) {
                    orariotreni.onOrderLoaded(JSON.stringify(data));
                }
            });
        });
    });
}
