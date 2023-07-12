import { useCallback, useEffect, useRef } from 'react'
import './App.css'
import io from 'socket.io-client';

const configuration = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] };

function App() {
  const remoteDescriptionReady = useRef(false);
  const videoRef = useRef();
  const socketRef = useRef(
    io(
      '192.168.100.8:3000',
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
        pc.addTrack(track, gumStream);
    }
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
      // await openCall();
      const offer = await pc.createOffer({ offerToReceiveAudio: false, offerToReceiveVideo: true });
      await pc.setLocalDescription(new RTCSessionDescription(offer));
      const rtcMessage = pc.localDescription;
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
      await openCall();
      const offer = data.rtcMessage;
      console.log("offer", offer.sdp);
      await pc.setRemoteDescription(new RTCSessionDescription(offer));
      remoteDescriptionReady.current = true;
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      const rtcMessage = pc.localDescription;
      onicecandidate();
      const response = {
        userId: data.userId,
        rtcMessage,
      };
      socket.emit('answerCall', response);
    } catch (error) {
      console.log("Error en la función onNewCall:", error);
    }
  }, [pc, socket, openCall, onicecandidate]);

  const onCallAnswered = useCallback(async (data) => {
    try {
      console.log("callanswered")
      const answer = data.rtcMessage;
      await pc.setRemoteDescription(new RTCSessionDescription(answer));
      remoteDescriptionReady.current = true;
      onicecandidate();
    } catch (error) {
      console.log("Error en la función onCallAnswered:", error);
    }
  }, [pc, onicecandidate]);

  const onICEcandidate = useCallback(async (data) => {
    if (!remoteDescriptionReady.current) return;
    try {
      const iceCandidate = data.rtcMessage;
      if(!iceCandidate?.candidate) return;
      await pc.addIceCandidate(new RTCIceCandidate(iceCandidate));
    } catch (error) {
      console.log("Error en la función onICEcandidate:", error);
    }
  }, [pc]);

  const onTrack = useCallback(() => {
    pc.ontrack = (event) => {
      if (event.streams && event.streams[0]) {
        const stream = event.streams[0];
        console.log("stream", stream);
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
    pc.onicecandidateerror = () => {
      console.log("onicecandidateerror:", pc.iceConnectionState);
    };
    pc.oniceconnectionstatechange = () => {
      console.log("oniceconnectionstatechange:", pc.iceGatheringState);
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
      <video playsInline ref={videoRef} autoPlay></video>
    </>
  )
}

export default App
