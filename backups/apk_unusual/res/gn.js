
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


function showTrain(id) {
    setTimeout(function() {
    	$(id).click();
        $('html, body').animate({
            scrollTop: $(id).offset().top
        }, 1000);
    }, 500);
}

function searchTrain(names) {
    console.log(names);
    $("h3.ui-accordion-header").each(function(i, train) {
        var trainN = $(train).find(".trainN").first();
        if (trainN) {
            var text = $(trainN).html();
            for (n in names) {
                if (text && names[n].length && text.indexOf(names[n]) >= 0) {
                    showTrain('#' + train.id);
                    return false;
                }
            }
        }
    });
}

function addHooks() {
    var btn = document.querySelector("input[id$='ButtonLogIn']");
    if (!btn) return;
    btn.addEventListener("click", function() {
        orariotreni.showLoading();
    });

   /* document.querySelector(".cookie-row-button-container").children[0].click();*/
}

function setUser(username, password) {
    try {
        document.querySelector("input[id$='TextBoxUserID']").value = username;
        document.querySelector("input[id$='PasswordFieldPassword']").value = password;
    } finally {}
}

function ot_startSearch(type, departure, arrival, day, month, rday, rmonth) {

    var btn = document.getElementById("RestylingMSiteNEASIBARView_ButtonSubmit");
    var btnContainer = btn.parentElement;
    btnContainer.removeChild(btn);

    var input = document.createElement("input");
    input.name = "RestylingMSiteNEASIBARView$ButtonSubmit";
    input.hidden = true;
    btnContainer.appendChild(input);

    var button = document.createElement("button");
    button.className = "button";
    button.innerText = "Continua";
    button.type = "button";
    button.addEventListener('click', function() {
        document.querySelector("input[name$='RadioButtonMarketStructure']").value    = type;
        document.querySelector("input[name$='TextBoxMarketOrigin1']").value          = departure;
        document.querySelector("input[name$='TextBoxMarketDestination1']").value     = arrival;
        document.querySelector("input[name$='DropDownListMarketDay1']").value        = day;
        document.querySelector("input[name$='DropDownListMarketMonth1']").value      = month;
        document.querySelector("input[name$='DropDownListMarketDay2']").value        = rday;
        document.querySelector("input[name$='DropDownListMarketMonth2']").value      = rmonth;
        document.getElementById("SkySales").submit();
        orariotreni.showLoading();
    });
    btnContainer.appendChild(button);
}
