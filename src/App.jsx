import { useCallback, useEffect, useRef, useState } from 'react'
import './App.css'
import io from 'socket.io-client';

const configuration = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] };

function App() {
  const videoRef = useRef();
  const socketRef = useRef(
    io(
      '192.168.100.11:3000',
      { auth: { userId: "webrtc1"}},
    ),
  );
  const pcRef = useRef(new RTCPeerConnection(configuration))
  const socket = socketRef?.current;
  const pc = pcRef.current;

  const openCall = useCallback(async () => {
    const gumStream = await navigator.mediaDevices.getUserMedia({
      video: true,
      audio: false,
    });
    for (const track of gumStream.getTracks()) {
      pc.addTrack(track);
    }
    videoRef.current.srcObject = gumStream;
  }, [pc]);

  const onicecandidate = useCallback(() => {
    pc.onicecandidate = event => {
      if (event.candidate) {
        // Enviar el candidato ICE al dispositivo receptor (puedes usar tu propia lógica de envío)
        const response = {
          userId: 'webrtc2',
          rtcMessage: event.candidate,
        }
        socket.emit('ICEcandidate', response);
      }
    };
  }, [socket, pc]);

  const handleCall = async () => {
    try {
      const offer = await pc.createOffer({ offerToReceiveAudio: false });
      pc.setLocalDescription(offer);
      const sdp = offer;
      const rtcMessage = sdp;
      const data = {
        deviceId: 'webrtc2',
        rtcMessage: rtcMessage,
      };
      socket.emit('call', data);
    } catch (error) {
      console.log("Error en la función call:", error);
    }
  };

  const handleAnswer = () => {
    
  }

  const onNewCall = useCallback(async (data) => {
    try {
      const offer = data.rtcMessage;
      await pc.setRemoteDescription(offer);
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      onicecandidate();
      await openCall();
      const sdp = answer;
      const response = {
        userId: data.userId,
        rtcMessage: sdp,
      };
      socket.emit('answerCall', response);
    } catch (error) {
      console.log("Error en la función onNewCall:", error);
    }
  }, [pc, socket, openCall, onicecandidate]);

  const onCallAnswered = useCallback(async (data) => {
    try {
      const answer = data.rtcMessage;
      await pc.setRemoteDescription(answer);
      await openCall();
      onicecandidate();
    } catch (error) {
      console.log("Error en la función onCallAnswered:", error);
    }
  }, [pc, openCall, onicecandidate]);

  const onICEcandidate = useCallback(async (data) => {
    try {
      const candidate = data.rtcMessage;
      await pc.addIceCandidate(new RTCIceCandidate(candidate));
    } catch (error) {
      console.log("Error en la función onICEcandidate:", error);
    }
  }, [pc]);

  const onTrack = useCallback(() => {
    pc.ontrack = (event) => {
      if (event.streams && event.streams[0]) {
        const stream = event.streams[0];
        if (videoRef.current && videoRef.current.srcObject !== stream) {
          videoRef.current.srcObject = stream;
        }
      }
    };
  }, [pc])

  useEffect(() => {
    socket.on('newCall', onNewCall);
    socket.on('callAnswered', onCallAnswered);
    socket.on('ICEcandidate', onICEcandidate);
    onTrack();
    pc.onsignalingstatechange = () => {
      console.log("signalingState:", pc.signalingState);
    };
    return () => {
      socket.off('newCall', onNewCall);
      socket.off('callAnswered', onCallAnswered);
      socket.off('ICEcandidate', onICEcandidate);
    }
  }, [
    socket,
    onNewCall,
    onCallAnswered,
    onICEcandidate,
    onTrack,
    pc,
  ]);

  return (
    <>
      <button onClick={handleCall}>Call</button>
      <button onClick={handleAnswer}>Answer</button>
      <video width={460} height={400} playsInline ref={videoRef} autoPlay></video>
    </>
  )
}

export default App
