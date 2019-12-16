const streamId="testStream";
let myroom=(parseInt(getParameterByName('streamId'))||1),myid,mystream,mypvtid;
httpGetAsync(`/ffmpeg-check-stream/${myroom}`,(exist)=> {
    if(parseInt(exist)===1) {
        $('#start').attr('disabled', true).unbind('click');
        alert('session already exists');
    }
    else{
        initJanusVideoRoom({
            webrtcState: function (on) {
                Janus.log("Janus says our WebRTC PeerConnection is " + (on ? "up" : "down") + " now");
                $("#videolocal").parent().parent().unblock();
                if (!on)
                    return;
                httpGetAsync(`/ffmpeg-forward-stream/${myroom}`, () => {
                    videoRoomPluginRequest({
                        "host": "127.0.0.1",
                        "request": "rtp_forward",
                        "room": myroom,
                        "publisher_id": myid,
                        "audio_port": 10000 + myroom * 4 - 2,
                        "audio_pt": 111,
                        "video_port": 10000 + myroom * 4,
                        "video_pt": 96,
                        "secret": "adminpwd"
                    }).then(() => {
                    });
                });

            },
            onmessage: function (msg, jsep) {
                Janus.debug(" ::: Got a message (publisher) :::");
                Janus.debug(msg);
                const event = msg["videoroom"];
                Janus.debug("Event: " + event);
                if (event !== undefined && event != null) {
                    if (event === "joined") {
                        myid = msg["id"];
                        mypvtid = msg["private_id"];
                        Janus.log("Successfully joined room " + msg["room"] + " with ID " + myid);
                        publishOwnFeed(true);
                    } else if (event === "destroyed") {
                        // The room has been destroyed
                        Janus.warn("The room has been destroyed!");
                        window.location.reload();
                    } else if (event === "event") {
                        if (msg["publishers"] !== undefined && msg["publishers"] !== null) {
                        } else if (msg["leaving"] !== undefined && msg["leaving"] !== null) {
                        } else if (msg["unpublished"] !== undefined && msg["unpublished"] !== null) {
                        } else if (msg["error"] !== undefined && msg["error"] !== null) {
                        }
                    }
                }
                if (jsep !== undefined && jsep !== null) {
                    Janus.debug("Handling SDP as well...");
                    Janus.debug(jsep);
                    videoRoom.handleRemoteJsep({jsep: jsep});
                    // Check if any of the media we wanted to publish has
                    // been rejected (e.g., wrong or unsupported codec)
                    var audio = msg["audio_codec"];
                    if (mystream && mystream.getAudioTracks() && mystream.getAudioTracks().length > 0 && !audio) {
                        // Audio has been rejected
                        toastr.warning("Our audio stream has been rejected, viewers won't hear us");
                    }
                    var video = msg["video_codec"];
                    if (mystream && mystream.getVideoTracks() && mystream.getVideoTracks().length > 0 && !video) {
                        // Video has been rejected
                        toastr.warning("Our video stream has been rejected, viewers won't see us");
                        // Hide the webcam video
                        $('#myvideo').hide();
                        $('#videolocal').append(
                            '<div class="no-video-container">' +
                            '<i class="fa fa-video-camera fa-5 no-video-icon" style="height: 100%;"></i>' +
                            '<span class="no-video-text" style="font-size: 16px;">Video rejected, no webcam</span>' +
                            '</div>');
                    }
                }
            },
            onlocalstream: function (stream) {
                Janus.debug(" ::: Got a local stream :::");
                mystream = stream;
                Janus.debug(stream);
                $('#start').unbind('click').text("Stop").removeAttr('disabled').click(unpublishOwnFeed);

                if ($('#myvideo').length === 0) {
                    $('#videolocal').append('<video class="rounded centered" id="myvideo" width="100%" height="100%" autoplay playsinline muted="muted"/>');
                    $('#videolocal').append('<button class="btn btn-warning btn-xs" id="mute" style="position: absolute; bottom: 0px; left: 0px; margin: 15px;">Mute</button>');
                    $('#mute').click(toggleMute);
                }

                Janus.attachMediaStream($('#myvideo').get(0), stream);
                $("#myvideo").get(0).muted = "muted";
                if (videoRoom.webrtcStuff.pc.iceConnectionState !== "completed" &&
                    videoRoom.webrtcStuff.pc.iceConnectionState !== "connected") {
                    $("#videolocal").parent().parent().block({
                        message: '<b>Publishing...</b>',
                        css: {
                            border: 'none',
                            backgroundColor: 'transparent',
                            color: 'white'
                        }
                    });
                }
                var videoTracks = stream.getVideoTracks();
                if (videoTracks === null || videoTracks === undefined || videoTracks.length === 0) {
                    // No webcam
                    $('#myvideo').hide();
                    if ($('#videolocal .no-video-container').length === 0) {
                        $('#videolocal').append(
                            '<div class="no-video-container">' +
                            '<i class="fa fa-video-camera fa-5 no-video-icon"></i>' +
                            '<span class="no-video-text">No webcam available</span>' +
                            '</div>');
                    }
                } else {
                    $('#videolocal .no-video-container').remove();
                    $('#myvideo').removeClass('hide').show();
                }
            },
            oncleanup: function () {

                Janus.log(" ::: Got a cleanup notification: we are unpublished now :::");
                mystream = null;
            }
        }).then(async () => {
            await initJanusStreaming({});
            await streamingPluginRequest({
                "request": "create",
                "type": "rtp",
                "id": myroom,
                "name": streamId + myroom,
                "audio": true,
                "video": true,
                "description": streamId + myroom,
                "audioport": 5000 + myroom * 4 - 2,
                "audiopt": 111,
                "audiortpmap": "opus/48000/2",
                "videoport": 5000 + myroom * 4,
                "videopt": 96,
                "videortpmap": "H264/90000",
                "secret": "adminpwd"
            });
            await videoRoomPluginRequest({
                "request": "create",
                "room": myroom,
                "permanent": false,
                "is_private": false,
                "publishers": 10000,
                "videocodec": "h264",
                "audiocodec": "opus",
                "video": true,
                "audio": true
            });
            $('#start').click(registerUsername);
            $('#view').attr('href', `/streamingtest.html?streamId=${myroom}`);


        });
    }
});


async function registerUsername() {
    $('#start').attr('disabled', true).unbind('click');
    await videoRoomPluginRequest({ "request": "join", "room": myroom,
        "ptype": "publisher", "display": 'testname' });
}

function publishOwnFeed(useAudio) {
    // Publish our stream
    $('#start').attr('disabled', true).unbind('click');
    videoRoom.createOffer(
        {
            // Add data:true here if you want to publish datachannels as well
            media: { audioRecv: false, videoRecv: false, audioSend: useAudio, videoSend: true },	// Publishers are sendonly
            // If you want to test simulcasting (Chrome and Firefox only), then
            // pass a ?simulcast=true when opening this demo page: it will turn
            // the following 'simulcast' property to pass to janus.js to true
            simulcast: false,
            simulcast2: false,
            success: function(jsep) {
                Janus.debug("Got publisher SDP!");
                Janus.debug(jsep);
                videoRoom.send({"message": { "request": "configure", "audio": useAudio, "video": true }, "jsep": jsep});
            },
            error: function(error) {
                Janus.error("WebRTC error:", error);
                if (useAudio) {
                    publishOwnFeed(false);
                } else {
                   // $('#start').unbind('click').removeAttr('disabled').click(function() { publishOwnFeed(true); });
                }
            }
        });
}

function toggleMute() {
    var muted = videoRoom.isAudioMuted();
    Janus.log((muted ? "Unmuting" : "Muting") + " local stream...");
    if(muted)
        videoRoom.unmuteAudio();
    else
        videoRoom.muteAudio();
    muted = videoRoom.isAudioMuted();
    $('#mute').html(muted ? "Unmute" : "Mute");
}

function unpublishOwnFeed() {
    videoRoom.send({"message":  { "request": "unpublish" }});
    $('#start').attr('disabled', true).unbind('click');
    httpGetAsync(`/ffmpeg-stop-stream/${myroom}`,()=> {
        window.location.reload();
    });
}

function newRemoteFeed(id, display, audio, video) {
    // A new feed has been published, create a new plugin handle and attach to it as a subscriber
    var remoteFeed = null;
    janus.attach(
        {
            plugin: "janus.plugin.videoroom",
            opaqueId: opaqueId,
            success: function(pluginHandle) {
                remoteFeed = pluginHandle;
                remoteFeed.simulcastStarted = false;
                Janus.log("Plugin attached! (" + remoteFeed.getPlugin() + ", id=" + remoteFeed.getId() + ")");
                Janus.log("  -- This is a subscriber");
                // We wait for the plugin to send us an offer
                var subscribe = { "request": "join", "room": myroom, "ptype": "subscriber", "feed": id, "private_id": mypvtid };
                // In case you don't want to receive audio, video or data, even if the
                // publisher is sending them, set the 'offer_audio', 'offer_video' or
                // 'offer_data' properties to false (they're true by default), e.g.:
                // 		subscribe["offer_video"] = false;
                // For example, if the publisher is VP8 and this is Safari, let's avoid video
                if(Janus.webRTCAdapter.browserDetails.browser === "safari" &&
                    (video === "vp9" || (video === "vp8" && !Janus.safariVp8))) {
                    if(video)
                        video = video.toUpperCase()
                    toastr.warning("Publisher is using " + video + ", but Safari doesn't support it: disabling video");
                    subscribe["offer_video"] = false;
                }
                remoteFeed.videoCodec = video;
                remoteFeed.send({"message": subscribe});
            },
            error: function(error) {
                Janus.error("  -- Error attaching plugin...", error);
            },
            onmessage: function(msg, jsep) {
                Janus.debug(" ::: Got a message (subscriber) :::");
                Janus.debug(msg);
                var event = msg["videoroom"];
                Janus.debug("Event: " + event);
                if(msg["error"] !== undefined && msg["error"] !== null) {
                } else if(event != undefined && event != null) {
                    if(event === "attached") {
                    } else if(event === "event") {
                    } else {
                        // What has just happened?
                    }
                }
                if(jsep !== undefined && jsep !== null) {
                    Janus.debug("Handling SDP as well...");
                    Janus.debug(jsep);
                    // Answer and attach
                    remoteFeed.createAnswer(
                        {
                            jsep: jsep,
                            // Add data:true here if you want to subscribe to datachannels as well
                            // (obviously only works if the publisher offered them in the first place)
                            media: { audioSend: false, videoSend: false },	// We want recvonly audio/video
                            success: function(jsep) {
                                Janus.debug("Got SDP!");
                                Janus.debug(jsep);
                                var body = { "request": "start", "room": myroom };
                                remoteFeed.send({"message": body, "jsep": jsep});
                            },
                            error: function(error) {
                                Janus.error("WebRTC error:", error);
                            }
                        });
                }
            },
            webrtcState: function(on) {
                Janus.log("Janus says this WebRTC PeerConnection (feed #" + remoteFeed.rfindex + ") is " + (on ? "up" : "down") + " now");
            },
            onlocalstream: function(stream) {
                // The subscriber stream is recvonly, we don't expect anything here
            },
            onremotestream: function(stream) {
                Janus.debug("Remote feed #" + remoteFeed.rfindex);
                if($('#remotevideo'+remoteFeed.rfindex).length === 0) {
                    // No remote video yet
                    $('#videoremote'+remoteFeed.rfindex).append('<video class="rounded centered" id="waitingvideo' + remoteFeed.rfindex + '" width=320 height=240 />');
                    $('#videoremote'+remoteFeed.rfindex).append('<video class="rounded centered relative hide" id="remotevideo' + remoteFeed.rfindex + '" width="100%" height="100%" autoplay playsinline/>');
                    $('#videoremote'+remoteFeed.rfindex).append(
                        '<span class="label label-primary hide" id="curres'+remoteFeed.rfindex+'" style="position: absolute; bottom: 0px; left: 0px; margin: 15px;"></span>' +
                        '<span class="label label-info hide" id="curbitrate'+remoteFeed.rfindex+'" style="position: absolute; bottom: 0px; right: 0px; margin: 15px;"></span>');
                    // Show the video, hide the spinner and show the resolution when we get a playing event
                    $("#remotevideo"+remoteFeed.rfindex).bind("playing", function () {
                        if(remoteFeed.spinner !== undefined && remoteFeed.spinner !== null)
                            remoteFeed.spinner.stop();
                        remoteFeed.spinner = null;
                        $('#waitingvideo'+remoteFeed.rfindex).remove();
                        if(this.videoWidth)
                            $('#remotevideo'+remoteFeed.rfindex).removeClass('hide').show();
                        var width = this.videoWidth;
                        var height = this.videoHeight;
                        $('#curres'+remoteFeed.rfindex).removeClass('hide').text(width+'x'+height).show();
                        if(Janus.webRTCAdapter.browserDetails.browser === "firefox") {
                            // Firefox Stable has a bug: width and height are not immediately available after a playing
                            setTimeout(function() {
                                var width = $("#remotevideo"+remoteFeed.rfindex).get(0).videoWidth;
                                var height = $("#remotevideo"+remoteFeed.rfindex).get(0).videoHeight;
                                $('#curres'+remoteFeed.rfindex).removeClass('hide').text(width+'x'+height).show();
                            }, 2000);
                        }
                    });
                }
                Janus.attachMediaStream($('#remotevideo'+remoteFeed.rfindex).get(0), stream);
                var videoTracks = stream.getVideoTracks();
                if(videoTracks === null || videoTracks === undefined || videoTracks.length === 0) {
                    // No remote video
                    $('#remotevideo'+remoteFeed.rfindex).hide();
                    if($('#videoremote'+remoteFeed.rfindex + ' .no-video-container').length === 0) {
                        $('#videoremote'+remoteFeed.rfindex).append(
                            '<div class="no-video-container">' +
                            '<i class="fa fa-video-camera fa-5 no-video-icon"></i>' +
                            '<span class="no-video-text">No remote video available</span>' +
                            '</div>');
                    }
                } else {
                    $('#videoremote'+remoteFeed.rfindex+ ' .no-video-container').remove();
                    $('#remotevideo'+remoteFeed.rfindex).removeClass('hide').show();
                }
            },
            oncleanup: function() {
                Janus.log(" ::: Got a cleanup notification (remote feed " + id + ") :::");
            }
        });
}


async function videoRoomPluginRequest(message) {
    return new Promise((resolve, reject) => {
        videoRoom.send({message, success: function(res) {
                resolve(res);
            }});
    })
}
