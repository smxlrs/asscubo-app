
var ot_history_hook_installed = false;

function ot_history_hook() {
    if (ot_history_hook_installed) return;
    var pushState = history.pushState;
    history.pushState = function(state, unused, url) {
        if (url) {
            orariotreni.urlChanged(url);
        }
        return pushState.apply(history, arguments);
    };
    ot_history_hook_installed = true;
}