const roomInput = document.getElementById('room');
const joinButton = document.getElementById('join');
const messageInput = document.getElementById('message');
const sendButton = document.getElementById('send');
const messagesDiv = document.getElementById('messages');

let peerConnection;
let dataChannel;
let room;
const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
const signalingServer = new WebSocket(`${protocol}//${window.location.host}`);

joinButton.addEventListener('click', () => {
    room = roomInput.value;
    signalingServer.send(JSON.stringify({ type: 'join', room }));
    setupPeerConnection();
});

sendButton.addEventListener('click', () => {
    const message = messageInput.value;
    dataChannel.send(message);
    displayMessage(`You: ${message}`);
});

signalingServer.onmessage = (message) => {
    const data = JSON.parse(message.data);
    if (data.type === 'offer') {
        peerConnection.setRemoteDescription(new RTCSessionDescription(data));
        peerConnection.createAnswer().then(answer => {
            peerConnection.setLocalDescription(answer);
            signalingServer.send(JSON.stringify({ type: 'signal', room, payload: answer }));
        });
    } else if (data.type === 'answer') {
        peerConnection.setRemoteDescription(new RTCSessionDescription(data));
    } else if (data.type === 'candidate') {
        peerConnection.addIceCandidate(new RTCIceCandidate(data));
    }
};

function setupPeerConnection() {
    peerConnection = new RTCPeerConnection();
    dataChannel = peerConnection.createDataChannel('chat');

    dataChannel.onopen = () => console.log('Data channel is open');
    dataChannel.onmessage = (event) => displayMessage(`Peer: ${event.data}`);

    peerConnection.onicecandidate = (event) => {
        if (event.candidate) {
            signalingServer.send(JSON.stringify({ type: 'signal', room, payload: event.candidate }));
        }
    };

    peerConnection.createOffer().then(offer => {
        peerConnection.setLocalDescription(offer);
        signalingServer.send(JSON.stringify({ type: 'signal', room, payload: offer }));
    });
}

function displayMessage(message) {
    const messageElement = document.createElement('div');
    messageElement.textContent = message;
    messagesDiv.appendChild(messageElement);
}
