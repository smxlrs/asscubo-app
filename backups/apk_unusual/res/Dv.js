/*
 this file will be converted to a single line, always use semi-colons ; never use single line comments
 ES6 syntax not supported in android 4
*/

function sendEvent(target, name) {
    var evt = document.createEvent("HTMLEvents");
    evt.initEvent(name, false, true);
    target.dispatchEvent(evt);
}

function onDialogShown() {
  if(!window.hook_user || !window.hook_pass) return;
  try {
        var button = document.querySelector("#loginDialog button[type='submit']");
        var username = document.getElementById("username");
        username.value = window.hook_user;
        sendEvent(username, "change");
        var password = document.getElementById("password");
        password.value = window.hook_pass;
        sendEvent(password, "change");
        button.focus();
        button.click()
    } catch(e) {
        console.log("autologin failed");
    }
}

function setAccount(user, pass) {
    window.hook_user = user;
    window.hook_pass = pass;
}

function installObserver() {
    if (window.observer_installed) { return; }
    var targetNode = document.body;
    var config = { attributes: true, childList: false, subtree: false };
    var callback = function(mutations, observer) {
        if (mutations[0].attributeName == "class" && mutations[0].target.className.includes("ux-dialog-open")) {
            onDialogShown();
        }
    };

    var observer = new MutationObserver(callback);
    observer.observe(targetNode, config);
    window.observer_installed = true;
}

function clickSolution(id, count) {
    console.log("clickSolution " + id + " (" + count + ")");
    var div = document.getElementById("solution-"+id);
    if (div) {
        div.children[0].click()
    } else if (count > 0) {
        window.setTimeout(function(){ clickSolution(id, count-1); }, 500);
    }

}

function normalizeName(name) {
    var name = name ? name.toLowerCase() : name;
    if (!name || name == "percorso a piedi" || name == "trasporto urbano" || name == "trasporto locale" || name == "urb" || name == "cambio stazione")
        return "";
    return name;
}

function namesMatch(a, b) {
    var aaa = normalizeName(a).split("/");
    var bbb = normalizeName(b).split("/");
    return aaa.some(function(x) { return bbb.includes(x) });
}

function findSolution(json, trains) {
    console.log("looking for trains " + trains);
    var solution = json.solutions.find(function(solution) {
        return solution.solution.trains.length == trains.length
                && solution.solution.trains.every(function(item, index) {
                    return namesMatch(trains[index], item.name);
                });
    });

    console.log("solution:"+solution);
    if (solution) {
        var solutionId = solution.solution.id;
        console.log("selecting: " + solutionId);
        clickSolution(solutionId, 20);
    } else {
        orariotreni.solutionNotFound();
    }
}

/*
function onPurchaseComplete(json) {
    var hasLoyaltyCard = !!json.travellers[0].loyaltyCode && json.travellers[0].loyaltyCode.length > 0;
    orariotreni.onPurchaseComplete(json.header.totalPrice.amount,json.header.totalPrice.currency, hasLoyaltyCard);
}
*/
function handleResponse(url, json) {
    console.log('handleResponse '+ window.hook_phase + ' ' + url);

    if (window.hook_phase == 'search' && url.includes('/website/cart')) {
        document.getElementById('search-button').click();
        setPhase('results');
    } else if (window.hook_phase == 'results' && url.includes('/website/ticket/solutions')) {
        var trains = json.searchId.includes("return") ? window.inward_trains : window.outward_trains;
        findSolution(json, trains);
    }/* else if (url.includes("/thankyou") && url.includes("/website/payment/")) {
        onPurchaseComplete(json);
    }*/
}

function setPhase(phase) {
    window.hook_phase = phase;
}

function setTrains(outward_trains, inward_trains) {
    window.outward_trains = outward_trains;
    window.inward_trains = inward_trains;
}

function addFetchHook() {

    if (window.hook_installed) { return; }

    var intercept_response_urls = [ '/website/cart', '/website/ticket/solutions', '/thankyou' ];

    console.log('addFetchHook');

    var systemFetch = window.fetch;

    window.fetch = function(request, options) {
        var url = (typeof request === 'string') ? request : request.url;
        var self = this;
        var args = arguments;

        if (intercept_response_urls.some(function(path) { return url.includes(path); })) {
            console.log('handling ' + url);
            return new Promise(function(resolve, reject){
                systemFetch.apply(self, args)
                    .then(function (response) {
                        response.clone().json().then(function(json) {
                            if (json) {
                                handleResponse(url, json);
                            }
                        })
                        .finally(function() {
                            resolve(response);
                        });
                    })
                    .catch(function(error) {
                        reject(error);
                    });
            });
        } else {
            return systemFetch.apply(self, args);
        }
    };

    window.hook_installed = true;

}

function setSession(originId, originName, destinationId, destinationName, adults, children, departureTimestamp, returnTimestamp, departureDate, solutionType) {
    sessionStorage['session'] = JSON.stringify({
        cartIdPurchaseState: {},
        ticketCriteria: {
            fastPurchase: {},
            origin: {
                id: originId,
                name: originName,
                displayName: originName,
                timezone: "",
                multistation: originName.includes("tutte le stazioni"),
                centroidId: null
            },
            destination: {
                id: destinationId,
                name: destinationName,
                displayName: destinationName,
                timezone: "",
                multistation: false,
                centroidId: null
            },
            departureDate: departureTimestamp,
            returnDate: returnTimestamp > 0 ? returnTimestamp : departureTimestamp,
            roundTrip: returnTimestamp > 0,
            adults: adults,
            children: children,
            filter: (solutionType == "HIGHSPEED" ? "FR" : solutionType == "LOCAL" ? "RG" : "PR"),
            order: "DEPARTURE_DATE",
            searchByOffer: [],
            bestPrice: false,
            searchByCF: false,
            moreOffers: false,
            codesCF: [
                ""
            ],
            origins: {
                "0": {},
                "1": {},
                "2": {},
                "3": {},
                "4": {}
            },
            destinations: {
                "0": {},
                "1": {},
                "2": {},
                "3": {},
                "4": {}
            },
            departureDates: {
                0: departureDate,
                1: departureDate,
                2: departureDate,
                3: departureDate,
                4: departureDate
            },
            departureTimes: {
                0: departureDate,
                1: departureDate,
                2: departureDate,
                3: departureDate,
                4: departureDate
            },
            currentTicketIndex: 0,
            miniGroup: false,
            multipleSelectedSolutions: {
                0: {},
                1: {},
                2: {},
                3: {},
                4: {}
            },
            departureTime: departureTimestamp,
            returnTime: returnTimestamp > 0 ? returnTimestamp : departureTimestamp,
            offset: 0,
            covidFreeExpressed: false,
            isReturnSolution: false,
            isLastSearches: false,
            lastSearches: false,
            analyticsSceltaRitorno: [],
            isPostoClickAnalytics: false,
            analyticsUpselling: [],
            oneClickSolution: false
        },
        lang:"it",
        currentStep:1,
        userAreaStep:{section:"",page:""},
        breadcrumb:{
            isHidden:false,
            searchKey:"breadcrumb.search",
            pickKey:"breadcrumb.pick.travel",
            pickKeyHidden:false,
            travellersKeyHidden:false
        },
        isCustomize:false,
        selezionaPosti:false,
        paidSeatSelection:false,
        basket: { canOpen: true },
        backBtn: { disabled: false, visible: true,label: "footer.backToSearch"},
        continueBtn: { disabled: false,visible: true,label: "footer.continue"},
        addTravelBtn: {disabled: false,visible: true,label: "footer.addTravel"},
        systemProperties: {},
        token: null,
        provider: null
    });
}