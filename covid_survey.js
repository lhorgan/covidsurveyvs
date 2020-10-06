var WAVE_NUMBER = -1;
var ORIGIN = null;
var COVID_19_PANEL_MEMBER_AID = 32; // TODO, real attribute
var WAVE_AIDS = [-1, 33, 34, 35, 36, 37, 38, 39, 44, 45, 46, 51, 52, 53];
var GAME_OVER = false;
var WAVES_COMPLETED = [];

var QUALTRICS_DATA_LOADED = false;

function receiveMessage(event) {
    console.log("EVENT RECEIVED");
    console.log(event);
    if(typeof(event.data) !== "string") {
        return;
    }
    //if we detect the survey is over, hide the frame and end experiment.
    if(event.data.startsWith("wave")) {
        if(event.data.startsWith("wave_")) {
            WAVE_NUMBER  = parseInt(event.data.substring(5));
        }
        else {
            WAVE_NUMBER  = parseInt(event.data.substring(4));
        }
        
        console.log("Wave is " + WAVE_NUMBER);
        fetchUserHT(function(data) {
            QUALTRICS_DATA_LOADED = true;
            console.log(data);
            // We got something back from the hash table
            if(myid in data && data[myid]["default"]) {
                var collectedContactInfo = data[myid]["default"]["collected_contact_info"];
                var wavesCompleted = data[myid]["default"]["waves_completed"];
                if(wavesCompleted) { // there is information on which waves have been completed
                    WAVES_COMPLETED = JSON.parse(wavesCompleted);
                    if(WAVES_COMPLETED.indexOf(WAVE_NUMBER) >= 0) {
                        alert("You have already participated in Wave " + WAVE_NUMBER + ".  You are not eligible for this HIT.");
                        experimentComplete();
                        return;
                    }
                }
                
                if(IS_AMT || collectedContactInfo) {
                    startSurvey();
                }
                else {
                    collectContactInfo();
                }
            }
            else { // Nothing in the hash table yet
                if(IS_AMT) {
                    startSurvey();
                }
                else {
                    collectContactInfo();
                }
            }
        });
    }
    else if(event.data == "complete fail" || event.data == "complete succeed" && !GAME_OVER) {
        GAME_OVER = true;
        vs_fbq("CompleteRegistration");
        $("#qualFrame").hide(); 
        
        WAVES_COMPLETED.push(WAVE_NUMBER);
        writeUserHT("waves_completed", JSON.stringify(WAVES_COMPLETED));
        
        if(IS_AMT) {
            payAMT(true);
        }
        else {
            assignAttribute(WAVE_AIDS[WAVE_NUMBER], function() {
                experimentComplete(); 
            });
        }
    }
}

function amtPreview() {
    $("#loading-spinner").hide();
    $("#amt-preview").show();
}

function initialize() {
    if(IS_AMT_PREVIEW) {
        amtPreview();
        return;
    }
    
    if(IS_AMT) {
        ORIGIN = "AMT";
    }
    else {
        ORIGIN = "";
        var originParam = getQueryString("FBAID");
        if(!originParam) {
            originParam = getQueryString("fbaid");
        }
        
        if(originParam) {
            ORIGIN = originParam;
        }
        console.log("origin is " + ORIGIN);
    }
    
    $("#survey_title").html(variables["title"]);
    window.addEventListener("message", receiveMessage, false);
    setTimeout(function() {
        if(!QUALTRICS_DATA_LOADED) {
            console.log("Forcing the survey to start.");
            startSurvey();
        }
    }, 5000);
    
    $("#qualFrame").attr("src",variables["survey_link"]+"&USER_UID="+USER_UID+"&ORIGIN="+ORIGIN);
    $("#qualFrame").height(variables["survey_height"]);
}

function collectContactInfo() {
    console.log("Creating subject input....");
    $("#loading-spinner").hide();
    $("#contact-info").show();
    createSubjectInput($("#empanelment-box"), function(status, info) {
        if(status === true) {
            vs_fbq("InitiateCheckout");
            $("#contact-info").hide();
            writeUserHT("collected_contact_info", "true");
            assignAttribute(COVID_19_PANEL_MEMBER_AID);
            startSurvey(); // just start without waiting for the attribute to go through
        }
        else {
            alert(info);
        }
    });   
}

function assignAttribute(aid, cb) {
    assignSubjectAttribute(aid, "", function(status, info) {
        if(status === true) {
            // presently, we are starting unconditionally   
        }
        else {
            console.error("Could not assign attribute: " + info);
            // todo: exponential backoff
        }
        if(typeof(cb) === "function") {
            cb(status, info);
        }
    });
}

/**
 * Get the value of a querystring
 * @param  {String} field The field to get the value of
 * @param  {String} url   The URL to get the value from (optional)
 * @return {String}       The field value
 */
// https://gomakethings.com/how-to-get-the-value-of-a-querystring-with-native-javascript/
// maybe add this to test.js?
function getQueryString(field, url) {
	var href = url ? url : window.location.href;
	var reg = new RegExp( '[?&]' + field + '=([^&#]*)', 'i' );
	var string = reg.exec(href);
	return string ? string[1] : null;
};

function startSurvey() {
    $("#loading-spinner").hide();
    $("#qualFrame").show();
}