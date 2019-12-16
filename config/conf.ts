export const conf = {
    "port": 5533,
    "ssl":{
        "key":"keys/privkey.pem",
        "cert":"keys/fullchain.pem"
    },
    "iceServers": [
        {
            "urls": ["turn:18.196.113.204:3478"],
            "username": "testUser",
            "credential": "testPassword"
        },
        {
            "urls": ["stun:18.196.113.204:3478"],
            "username": "testUser",
            "credential": "testPassword"
        }
    ]
};
