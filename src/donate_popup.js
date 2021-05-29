function never_alert() {
    console.log("Setting neveralert to true")
    chrome.storage.sync.set({neveralert: true}, function() {
        console.log('Value is set to ' + true);
    });
}

function alert_after() {
    let until = new Date()
    until.setDate(until.getDate() + 5)
    console.log("Setting next alert to be at", until)
    chrome.storage.sync.set({alertafter: until.toString()}, function() {
        console.log('Value is set to ' + until);
    });
}

function setup() {
    document.getElementById("neveralert_button").addEventListener("click", never_alert)
    document.getElementById("alertafter_button").addEventListener("click", alert_after)
}

window.addEventListener('load', function () {
    window.setTimeout(setup(), 0); // Event loop quirk. Don't question it. I don't.
})