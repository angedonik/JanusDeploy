const streamId="testStream";

initJanusStreaming({}).then(async () => {
    const listData=await getListData();
    const table=document.getElementById('table');
    if(listData && listData.list){
        while (listData.list.length) {
            const id=listData.list.shift().id;
            addRow(table,id)
        }
        document.getElementById('addButton').addEventListener('click',async ()=>{
            const listData=await getListData();
            let newId;
            if(!listData.list.length){
                newId=1;
            }
            else {
                newId = Math.max.apply(null, listData.list.map(e=>e.id))+1;
            }
            const answer=await streamingPluginRequest({
                "request" : "create",
                "type" : "rtp",
                "id" : newId,
                "name": streamId+newId,
                "audio": true,
                "video": true,
                "description" : streamId+newId,
                "audioport" : 5000+newId*4-2,
                "audiopt" : 111,
                "audiortpmap" : "opus/48000/2",
                "videoport" : 5000+newId*4,
                "videopt" : 96,
                "videortpmap" : "H264/90000",
                "secret" : "adminpwd" });
            if(answer && answer.stream){
                addRow(table,answer.stream.id)
            }

        });
    }
});
function addRow(table,id) {
    const tr=document.createElement('tr');
    const td1=document.createElement('td');
    const cmd=`ffmpeg -re -thread_queue_size 4 -stream_loop -1 -i INPUT -s 852x480 -c:v libx264 -profile:v baseline -b:v 1200k -r 24 -g 120 -flags:v +global_header -bsf:v "dump_extra=freq=keyframe" -max_delay 0 -bf 0 -an -tune zerolatency -f rtp rtp://${window.location.hostname}:${5000+id*4}?pkt_size=1200 -vn -ar 48000 -ac 2 -c:a libopus -f rtp rtp://${window.location.hostname}:${5000+id*4-2}?pkt_size=1200`;
    const input = document.createElement('input');
    input.style.width="calc(100% - 100px)";
    input.setAttribute('readonly',true);
    input.value = cmd;
    td1.appendChild(input);
    const copyButton=document.createElement('button');
    copyButton.addEventListener('click',()=>{
        input.select();
        document.execCommand('copy');
    });
    copyButton.innerText='Copy';
    td1.appendChild(copyButton);
    td1.style.width="100%";
    tr.appendChild(td1);
    const td2=document.createElement('td');

    td2.innerHTML=`<a style="margin-right: 10px" target="_blank" href="/streamingtest.html?streamId=${id}">View</a>`;
    tr.appendChild(td2);
    const td3=document.createElement('td');
    const removeButton=document.createElement('button');
    removeButton.addEventListener('click',async ()=>{
        const answer=await streamingPluginRequest({
            "request" : "destroy",
            id,
            "secret" : "adminpwd"
        });
        if(answer){
            table.removeChild(tr);
        }
    });
    removeButton.innerText='X';
    td3.appendChild(removeButton);
    tr.appendChild(td3);
    table.appendChild(tr);
}