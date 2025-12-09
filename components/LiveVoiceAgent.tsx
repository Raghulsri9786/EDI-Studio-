
import React, { useState, useRef, useEffect } from 'react';
import { Mic, MicOff, X, Activity, Volume2, Files, User, Cpu, AlertTriangle, Lock } from 'lucide-react';
import { GoogleGenAI, LiveServerMessage, Modality } from '@google/genai';
import { EdiFile } from '../types';
import { getGeminiKey } from '../services/geminiService';

interface LiveVoiceAgentProps {
  isOpen: boolean;
  onClose: () => void;
  files: EdiFile[];
  hasApiKey?: boolean;
}

const LiveVoiceAgent: React.FC<LiveVoiceAgentProps> = ({ isOpen, onClose, files, hasApiKey = true }) => {
  const [isConnected, setIsConnected] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Refs for Audio Contexts and cleanup
  const inputContextRef = useRef<AudioContext | null>(null);
  const outputContextRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const nextStartTimeRef = useRef<number>(0);
  const sourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  const sessionRef = useRef<any>(null);

  useEffect(() => {
    if (isOpen) {
      if (hasApiKey) {
        startSession();
      } else {
        setError("Gemini API Key Required. Please add it in Settings.");
      }
    } else {
      stopSession();
    }
    return () => stopSession();
  }, [isOpen, hasApiKey]);

  const startSession = async () => {
    try {
      setError(null);
      setIsConnected(false); // Reset connection state
      
      const apiKey = getGeminiKey();
      if (!apiKey) {
         setError("Gemini API Key is missing.");
         return;
      }

      const ai = new GoogleGenAI({ apiKey });
      
      // Initialize Audio Contexts
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      const inputCtx = new AudioContextClass({ sampleRate: 16000 });
      const outputCtx = new AudioContextClass({ sampleRate: 24000 });
      
      inputContextRef.current = inputCtx;
      outputContextRef.current = outputCtx;
      nextStartTimeRef.current = outputCtx.currentTime;

      // CONSTRUCT CONTEXT FROM SELECTED FILES
      // This ensures the model "sees" the data the user is looking at
      const fileContext = files.length > 0 
        ? files.map(f => `
--- FILE START: ${f.name} ---
${f.content.substring(0, 15000)} 
--- FILE END ---
        `).join('\n')
        : "No specific files selected. Answer general EDI questions.";

      const systemInstruction = `
      You are an expert EDI Voice Assistant connected to a live file workspace.
      
      YOUR DATA CONTEXT:
      ${fileContext}
      
      INSTRUCTIONS:
      1. Use the data above to answer user questions about their specific files.
      2. If they ask about "the 850" or "the invoice", refer to the file content above.
      3. Be concise and professional. Do not read long segments unless asked.
      4. If the file content is truncated, mention it.
      `;

      // Connect to Live API
      const sessionPromise = ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-09-2025',
        callbacks: {
          onopen: async () => {
            setIsConnected(true);
            
            try {
              // Check for browser support
              if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
                throw new Error("Microphone is not supported in this browser.");
              }

              // Start Microphone Stream with error handling
              const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
              streamRef.current = stream;
              
              const source = inputCtx.createMediaStreamSource(stream);
              const scriptProcessor = inputCtx.createScriptProcessor(4096, 1, 1);
              
              scriptProcessor.onaudioprocess = (e) => {
                const inputData = e.inputBuffer.getChannelData(0);
                const pcmBlob = createBlob(inputData);
                sessionPromise.then(session => {
                  session.sendRealtimeInput({ media: pcmBlob });
                });
              };
              
              source.connect(scriptProcessor);
              scriptProcessor.connect(inputCtx.destination);
            } catch (err: any) {
              console.error("Microphone Access Error:", err);
              if (err.name === 'NotAllowedError' || err.message.includes('dismissed')) {
                 setError("Microphone permission denied. Please allow access in browser settings.");
              } else {
                 setError("Microphone error: " + err.message);
              }
              setIsConnected(false);
              sessionPromise.then(s => s.close());
            }
          },
          onmessage: async (message: LiveServerMessage) => {
             // Handle Audio Output
             const base64Audio = message.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
             if (base64Audio) {
               setIsSpeaking(true);
               
               // Ensure we play consecutively
               nextStartTimeRef.current = Math.max(nextStartTimeRef.current, outputCtx.currentTime);
               
               const audioBuffer = await decodeAudioData(
                 decode(base64Audio),
                 outputCtx,
                 24000,
                 1
               );
               
               const source = outputCtx.createBufferSource();
               source.buffer = audioBuffer;
               source.connect(outputCtx.destination);
               
               source.addEventListener('ended', () => {
                 sourcesRef.current.delete(source);
                 if (sourcesRef.current.size === 0) setIsSpeaking(false);
               });
               
               source.start(nextStartTimeRef.current);
               nextStartTimeRef.current += audioBuffer.duration;
               sourcesRef.current.add(source);
             }

             // Handle Interruptions
             if (message.serverContent?.interrupted) {
               sourcesRef.current.forEach(src => src.stop());
               sourcesRef.current.clear();
               nextStartTimeRef.current = outputCtx.currentTime;
               setIsSpeaking(false);
             }
          },
          onclose: () => {
            setIsConnected(false);
          },
          onerror: (e) => {
            console.error(e);
            setError("Connection Error. Please check your network.");
            setIsConnected(false);
          }
        },
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Zephyr' } }
          },
          systemInstruction: systemInstruction,
        }
      });
      
      sessionRef.current = sessionPromise;

    } catch (err) {
      console.error(err);
      setError("Failed to initialize voice session.");
    }
  };

  const stopSession = () => {
    setIsConnected(false);
    
    // Close Audio Contexts safely
    if (inputContextRef.current && inputContextRef.current.state !== 'closed') {
      inputContextRef.current.close().catch(console.error);
    }
    if (outputContextRef.current && outputContextRef.current.state !== 'closed') {
      outputContextRef.current.close().catch(console.error);
    }
    
    // Stop Mic Stream
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
  };

  // --- Audio Helpers ---
  function createBlob(data: Float32Array): any {
    const l = data.length;
    const int16 = new Int16Array(l);
    for (let i = 0; i < l; i++) {
      int16[i] = data[i] * 32768;
    }
    let binary = '';
    const bytes = new Uint8Array(int16.buffer);
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    const b64 = btoa(binary);
    
    return {
      data: b64,
      mimeType: 'audio/pcm;rate=16000'
    };
  }

  function decode(base64: string) {
    const binaryString = atob(base64);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes;
  }

  async function decodeAudioData(
    data: Uint8Array,
    ctx: AudioContext,
    sampleRate: number,
    numChannels: number,
  ): Promise<AudioBuffer> {
    const dataInt16 = new Int16Array(data.buffer);
    const frameCount = dataInt16.length / numChannels;
    const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);

    for (let channel = 0; channel < numChannels; channel++) {
      const channelData = buffer.getChannelData(channel);
      for (let i = 0; i < frameCount; i++) {
        channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
      }
    }
    return buffer;
  }

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/80 backdrop-blur-sm animate-in fade-in">
      <div className="bg-white rounded-2xl p-8 shadow-2xl max-w-sm w-full relative flex flex-col items-center gap-6 border-t-4 border-indigo-600">
        <button 
          onClick={onClose} 
          className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 p-1"
        >
          <X size={20} />
        </button>

        {/* Visualizer Circle */}
        <div className={`relative w-32 h-32 rounded-full flex items-center justify-center transition-all duration-500 ${isSpeaking ? 'bg-indigo-100 scale-110' : (error ? 'bg-red-50' : 'bg-slate-50')}`}>
          {isConnected && !error && (
            <div className={`absolute inset-0 rounded-full border-4 border-indigo-500/30 animate-ping ${isSpeaking ? 'opacity-100' : 'opacity-0'}`}></div>
          )}
          <div className={`w-24 h-24 rounded-full flex items-center justify-center shadow-inner transition-colors ${error ? 'bg-red-100 text-red-500' : (isConnected ? 'bg-gradient-to-br from-indigo-600 to-blue-600 text-white shadow-lg' : 'bg-slate-200 text-slate-400')}`}>
            {error ? <AlertTriangle size={40} /> : <Mic size={40} className={isConnected ? "" : "opacity-50"} />}
          </div>
        </div>

        <div className="text-center">
          <h3 className="text-xl font-bold text-slate-800">
            {error ? "Configuration Error" : (isConnected ? (isSpeaking ? "Speaking..." : "Listening...") : "Connecting...")}
          </h3>
          <p className="text-sm text-slate-500 mt-2 flex items-center justify-center gap-2">
            <Cpu size={14} /> Gemini Live Agent
          </p>
          <div className="mt-4 flex items-center justify-center gap-2 bg-slate-100 px-3 py-2 rounded-lg border border-slate-200">
             <Files size={14} className={files.length > 0 ? "text-emerald-500" : "text-slate-400"} />
             <span className="text-xs font-semibold text-slate-700">
               {files.length > 0 ? `${files.length} Files in Context` : "No specific files selected"}
             </span>
          </div>
          {error && <p className="text-xs text-red-600 mt-4 font-bold bg-red-50 px-3 py-2 rounded border border-red-100">{error}</p>}
        </div>

        <div className="flex gap-4 w-full">
          <button 
            onClick={onClose}
            className="w-full py-2.5 rounded-lg border border-slate-300 text-slate-600 hover:bg-slate-50 font-bold text-sm transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default LiveVoiceAgent;
