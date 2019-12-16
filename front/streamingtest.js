const server = "https://" + window.location.hostname + ":8881/janus";

var janus = null;
var streaming = null;
var opaqueId = "streamingtest-"+Janus.randomString(12);

var spinner = null;

var simulcastStarted = false, svcStarted = false;

function httpGetAsync(theUrl, callback)
{
    const xmlHttp = new XMLHttpRequest();
    xmlHttp.onreadystatechange = function() {
        if (xmlHttp.readyState === 4 && xmlHttp.status === 200)
            callback(xmlHttp.responseText);
    };
    xmlHttp.open("GET", theUrl, true);
    xmlHttp.send(null);
}


function getParameterByName(name, url) {
    if (!url) url = window.location.href;
    name = name.replace(/[\[\]]/g, "\\$&");
    var regex = new RegExp("[?&]" + name + "(=([^&#]*)|&|#|$)"),
        results = regex.exec(url);
    if (!results) return null;
    if (!results[2]) return '';
    return decodeURIComponent(results[2].replace(/\+/g, " "));
}
var selectedStream = getParameterByName('streamId');

$(document).ready(function() {
    httpGetAsync('/get-ice-servers',(responseText)=>{
        // Initialize the library (all console debuggers enabled)
        Janus.init({debug: "all", callback: function() {
                // Use a button to start the demo
                $('#start').one('click', function() {
                    $(this).attr('disabled', true).unbind('click');
                    // Make sure the browser supports WebRTC
                    if(!Janus.isWebrtcSupported()) {
                        bootbox.alert("No WebRTC support... ");
                        return;
                    }
                    // Create session
                    janus = new Janus(
                        {
                            iceServers:JSON.parse(responseText),
                            apisecret: "oriejVlukKrlx7t2MjtcdSxQdR4IoPfD",
                            server: server,
                            iceTransportPolicy:'relay',
                            success: function() {
                                // Attach to streaming plugin
                                janus.attach(
                                    {
                                        plugin: "janus.plugin.streaming",
                                        opaqueId: opaqueId,
                                        success: function(pluginHandle) {
                                            streaming = pluginHandle;
                                            Janus.log("Plugin attached! (" + streaming.getPlugin() + ", id=" + streaming.getId() + ")");
                                            startStream();

                                        },
                                        error: function(error) {
                                            Janus.error("  -- Error attaching plugin... ", error);
                                            //bootbox.alert("Error attaching plugin... " + error);
                                        },
                                        onmessage: function(msg, jsep) {
                                            Janus.debug(" ::: Got a message :::");
                                            Janus.debug(msg);
                                            var result = msg["result"];
                                            if(result !== null && result !== undefined) {
                                                if(result["status"] !== undefined && result["status"] !== null) {
                                                    var status = result["status"];
                                                    if(status === 'starting') {}
                                                    else if(status === 'started'){}
                                                    else if(status === 'stopped')
                                                        stopStream();
                                                } else if(msg["streaming"] === "event") {
                                                    // Is simulcast in place?
                                                    var substream = result["substream"];
                                                    var temporal = result["temporal"];
                                                    if((substream !== null && substream !== undefined) || (temporal !== null && temporal !== undefined)) {
                                                        if(!simulcastStarted) {
                                                            simulcastStarted = true;
                                                        }
                                                        // We just received notice that there's been a switch, update the buttons
                                                    }
                                                    // Is VP9/SVC in place?
                                                    var spatial = result["spatial_layer"];
                                                    temporal = result["temporal_layer"];
                                                    if((spatial !== null && spatial !== undefined) || (temporal !== null && temporal !== undefined)) {
                                                        if(!svcStarted) {
                                                            svcStarted = true;
                                                        }
                                                        // We just received notice that there's been a switch, update the buttons
                                                    }
                                                }
                                            } else if(msg["error"] !== undefined && msg["error"] !== null) {
                                                bootbox.alert(msg["error"]);
                                                stopStream();
                                                return;
                                            }
                                            if(jsep !== undefined && jsep !== null) {
                                                Janus.debug("Handling SDP as well...");
                                                Janus.debug(jsep);
                                                // Offer from the plugin, let's answer
                                                streaming.createAnswer(
                                                    {
                                                        jsep: jsep,
                                                        // We want recvonly audio/video and, if negotiated, datachannels
                                                        media: { audioSend: false, videoSend: false, data: true },
                                                        success: function(jsep) {
                                                            Janus.debug("Got SDP!");
                                                            Janus.debug(jsep);
                                                            var body = { "request": "start" };
                                                            streaming.send({"message": body, "jsep": jsep});
                                                        },
                                                        error: function(error) {
                                                            Janus.error("WebRTC error:", error);
                                                            bootbox.alert("WebRTC error... " + JSON.stringify(error));
                                                        }
                                                    });
                                            }
                                        },
                                        onremotestream: function(stream) {
                                            Janus.debug(" ::: Got a remote stream :::");
                                            Janus.debug(stream);
                                            var addButtons = false;
                                            if($('#remotevideo').length === 0) {
                                                addButtons = true;
                                                $('#stream').append('<video class="rounded centered hide" id="remotevideo" autoplay playsinline/>');
                                                // Show the stream and hide the spinner when we get a playing event
                                                $("#remotevideo").bind("playing", function () {
                                                    $('#waitingvideo').remove();
                                                    if(this.videoWidth)
                                                        $('#remotevideo').removeClass('hide').show();
                                                    if(spinner !== null && spinner !== undefined)
                                                        spinner.stop();
                                                    spinner = null;
                                                    var videoTracks = stream.getVideoTracks();
                                                    if(videoTracks === null || videoTracks === undefined || videoTracks.length === 0)
                                                        return;
                                                    var width = this.videoWidth;
                                                    var height = this.videoHeight;
                                                    $('#curres').removeClass('hide').text(width+'x'+height).show();
                                                    if(Janus.webRTCAdapter.browserDetails.browser === "firefox") {
                                                        // Firefox Stable has a bug: width and height are not immediately available after a playing
                                                        setTimeout(function() {
                                                            var width = $("#remotevideo").get(0).videoWidth;
                                                            var height = $("#remotevideo").get(0).videoHeight;
                                                            $('#curres').removeClass('hide').text(width+'x'+height).show();
                                                        }, 2000);
                                                    }
                                                });
                                            }
                                            Janus.attachMediaStream($('#remotevideo').get(0), stream);
                                            var videoTracks = stream.getVideoTracks();
                                            if(videoTracks === null || videoTracks === undefined || videoTracks.length === 0) {
                                                // No remote video
                                                $('#remotevideo').hide();
                                            } else {
                                                $('#remotevideo').removeClass('hide').show();
                                            }
                                        },
                                        ondataopen: function(data) {
                                            Janus.log("The DataChannel is available!");
                                            if(spinner !== null && spinner !== undefined)
                                                spinner.stop();
                                            spinner = null;
                                        },
                                        ondata: function(data) {
                                            Janus.debug("We got data from the DataChannel! " + data);
                                        },
                                        oncleanup: function() {
                                            Janus.log(" ::: Got a cleanup notification :::");
                                        }
                                    });
                            },
                            error: function(error) {
                                Janus.error(error);
                                bootbox.alert(error, function() {
                                    window.location.reload();
                                });
                            },
                            destroyed: function() {
                                window.location.reload();
                            }
                        });
                });
            }});
    });

});

function startStream() {
    Janus.log("Selected video id #" + selectedStream);
    if(selectedStream === undefined || selectedStream === null) {
        return;
    }
    var body = { "request": "watch", id: parseInt(selectedStream) };
    streaming.send({"message": body});
    // No remote video yet
    if(spinner == null) {
        var target = document.getElementById('stream');
        spinner = new Spinner({top:100}).spin(target);
    } else {
        spinner.spin();
    }
}