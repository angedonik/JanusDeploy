import {conf} from './config/conf';
import {createServer} from 'https';
import {readFileSync} from 'fs';
import * as express from 'express';
import * as cors from 'cors';
import * as console_stamp from 'console-stamp';
import {join as pathJoin} from "path";
import {exec} from "child_process";

console_stamp(console, '[HH:MM:ss.l]');


const ffmpegs={local:{}};
const app = express();
app.use(cors());
const httpsServer = createServer({
    key: readFileSync(conf.ssl.key),
    cert: readFileSync(conf.ssl.cert)
}, app);
httpsServer.listen(conf.port, ()=> {
    console.log('Server is listening on port '+conf.port);
});
app.use(express.static(pathJoin(__dirname,'front')));

app.use('/demos',express.static('/opt/janus/share/janus/demos'));

app.get('/get-ice-servers',async (req,res)=> {
    res.send(JSON.stringify(conf.iceServers));
});
app.get('/ffmpeg-check-stream/:id',async (req,res)=> {
    const streamId=parseInt(req.url.split('/').pop());
    res.send(`${ffmpegs.local[streamId]?1:0}`);
});
app.get('/ffmpeg-forward-stream/:id',async (req,res)=> {
    runStreamForward(parseInt(req.url.split('/').pop()),()=>{
        res.send('OK');
    });
});
app.get('/ffmpeg-stop-stream/:id',async (req,res)=> {
    const streamId=parseInt(req.url.split('/').pop());
    if(ffmpegs.local[streamId]){
        const p=ffmpegs.local[streamId];
        p.on('exit',()=>{
            res.send('OK');
        });
    }
    else {
        res.send('OK');
    }
});
function runStreamForward(streamId,callback) {
    const cmd=`ffmpeg -protocol_whitelist pipe,udp,rtp -i - -c:v copy -flags:v +global_header -bsf:v "dump_extra=freq=keyframe" -bf 0 -an -tune zerolatency -f rtp rtp://127.0.0.1:${5000+streamId*4}?pkt_size=1200 -c:a copy -vn -f rtp rtp://127.0.0.1:${5000+streamId*4-2}?pkt_size=1200`;
    //const cmd=`ffmpeg -protocol_whitelist pipe,udp,rtp -i - -c:v libx264  -vf scale="-1:240" -b:v 300k -flags:v +global_header -bsf:v "dump_extra=freq=keyframe" -bf 0 -an -tune zerolatency -f rtp rtp://127.0.0.1:${5000+streamId*4}?pkt_size=1200 -b:a 64k -ar 48000  -async 10000 -ac 2 -c:a libopus  -vn -f rtp rtp://127.0.0.1:${5000+streamId*4-2}?pkt_size=1200`;
    console.log(cmd);
    const p=exec(cmd,{detached:false} as any);
    p.stdin.write(`v=0
o=- 0 0 IN IP4 127.0.0.1
c=IN IP4 127.0.0.1
t=0 0
a=tool:libavformat 56.15.102
m=audio ${10000+streamId*4-2} RTP/AVP 111
a=rtpmap:111 OPUS/48000/2
m=video ${10000+streamId*4} RTP/AVP 96
a=rtpmap:96 H264/90000`);
    p.stdin.end();
    p.stderr.on('data',(data)=>{
        console.log(data.toString());
        if(callback){
            setTimeout(callback,5000);
            callback=null;
        }
    });
    p.on('exit',(code)=>{
        console.log(`exit ${code}`);
        delete ffmpegs.local[streamId];
    });
    ffmpegs.local[streamId]=p;
}