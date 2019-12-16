const server = "https://" + window.location.hostname + ":8881/janus";
let janusReady=false;
let iceServers;
let streaming,videoRoom;

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
async function getIceServers() {
    return new Promise((resolve, reject) => {
        if(iceServers){
            resolve(iceServers);
        }
        else {
            httpGetAsync('/get-ice-servers',(responseText)=> {
                iceServers=JSON.parse(responseText);
                resolve(iceServers);
            });
        }
    });
}
async function initJanus(){
    return new Promise((resolve, reject) => {
        if(!janusReady){
            Janus.init({
                debug: "all", callback: function () {
                    if(!Janus.isWebrtcSupported()) {
                        reject("No WebRTC support... ");
                        return;
                    }
                    resolve();
                }
            });
        }
        else {
            resolve();
        }

    });
}
async function createJanus(){
    await initJanus();
    return new Promise(async (resolve, reject) => {

        const janus=new Janus(
            {
                apisecret: "oriejVlukKrlx7t2MjtcdSxQdR4IoPfD",
                iceServers: await getIceServers(),
                server: server,
                iceTransportPolicy: 'relay',
                success:()=>{
                    resolve(janus)
                },
                error: function (error) {
                    Janus.error(error);
                    window.location.reload();
                },
                destroyed: function () {
                    window.location.reload();
                }
            }
        );
    });
}
async function initJanusStreaming(params){
    return new Promise(async (resolve, reject) => {
        const janus = await createJanus();
        params.plugin = "janus.plugin.streaming";
        params.opaqueId = "streamingtest-" + Janus.randomString(12);
        params.success = function (pluginHandle) {
            Janus.log("Plugin attached! (" + pluginHandle.getPlugin() + ", id=" + pluginHandle.getId() + ")");
            streaming = pluginHandle;
            resolve(pluginHandle);
        };
        params.error = function (error) {
            Janus.error("  -- Error attaching plugin... ", error);
        };
        params.onmessage = function (msg) {
            Janus.debug(" ::: Got a message :::");
            Janus.debug(msg);
        };
        params.ondata = function (data) {
            Janus.debug("We got data from the DataChannel! " + data);
        };
        params.oncleanup = function () {
            Janus.log(" ::: Got a cleanup notification :::");
        };
        janus.attach(params);
    });
}
async function initJanusVideoRoom(params){
    return new Promise(async (resolve, reject) => {
        const janus = await createJanus();
        params.plugin = "janus.plugin.videoroom";
        params.opaqueId = "videoroomtest-" + Janus.randomString(12);
        params.success = function (pluginHandle) {
            Janus.log("Plugin attached! (" + pluginHandle.getPlugin() + ", id=" + pluginHandle.getId() + ")");
            videoRoom = pluginHandle;
            resolve(pluginHandle);
        };
        params.error = function (error) {
            Janus.error("  -- Error attaching plugin... ", error);
        };
        params.mediaState = (medium, on) => {
            Janus.log("Janus " + (on ? "started" : "stopped") + " receiving our " + medium);
        };
        params.onremotestream = () => {
        };
        janus.attach(params);
    });
}
async function getListData() {
    return streamingPluginRequest({ "request": "list" });
}
async function streamingPluginRequest(message) {
    return new Promise((resolve, reject) => {
        streaming.send({message, success: function(res) {
                resolve(res);
            }});
    })
}
function getParameterByName(name, url) {
    if (!url) url = window.location.href;
    name = name.replace(/[\[\]]/g, "\\$&");
    const regex = new RegExp("[?&]" + name + "(=([^&#]*)|&|#|$)"),
        results = regex.exec(url);
    if (!results) return null;
    if (!results[2]) return '';
    return decodeURIComponent(results[2].replace(/\+/g, " "));
}