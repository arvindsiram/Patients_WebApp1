import { useEffect, useRef } from 'react';
import { MessageSquare } from 'lucide-react';

interface VoiceflowChatProps {
  onChatComplete: () => void;
}

declare global {
  interface Window {
    voiceflow?: any;
  }
}

export function VoiceflowChat({ onChatComplete }: VoiceflowChatProps) {
  const scriptLoaded = useRef(false);

  useEffect(() => {
    if (scriptLoaded.current) return;

    const script = document.createElement('script');
    script.type = 'text/javascript';
    script.src = 'https://cdn.voiceflow.com/widget-next/bundle.mjs';
    script.async = true;

    script.onload = () => {
      if (window.voiceflow?.chat) {
        window.voiceflow.chat.load({
          verify: { projectID: '6965131c801bdbafb7f40e5b' },
          url: 'https://general-runtime.voiceflow.com',
          versionID: 'production',
          assistant: {
            extensions: [
              {
                name: 'ext_darkForm',
                type: 'response',
                match: ({ trace }: any) => {
                  return trace.type === 'ext_darkForm' || trace.payload?.name === 'ext_darkForm';
                },
                render: ({ trace, element }: any) => {
                  if (element.querySelector('.med-form')) return;

                  const formContainer = document.createElement('div');
                  formContainer.style.cssText = "width: 100%; padding: 15px; background: #1a1a1a; border-radius: 10px; border: 1px solid #333;";
                
                  formContainer.innerHTML = `
                    <div class="med-form" style="display: flex; flex-direction: column; gap: 10px;">
                      <h3 style="color: #4dabf7; margin-bottom: 5px;">Patient Intake</h3>
                      <input type="text" id="n" placeholder="Name" required style="padding: 10px; background: #222; color: white; border: 1px solid #444; border-radius: 5px;">
                      <input type="email" id="e" placeholder="Email" required style="padding: 10px; background: #222; color: white; border: 1px solid #444; border-radius: 5px;">
                      <input type="tel" id="p" placeholder="Phone Number" required style="padding: 10px; background: #222; color: white; border: 1px solid #444; border-radius: 5px;">
                      <textarea id="s" placeholder="Symptoms" style="padding: 10px; background: #222; color: white; border: 1px solid #444; border-radius: 5px; min-height: 60px;"></textarea>
                      <button id="sub" style="padding: 12px; background: #007bff; color: white; font-weight: bold; border: none; border-radius: 5px; cursor: pointer; margin-top: 5px;">Submit Information</button>
                    </div>
                  `;
                
                  formContainer.querySelector('#sub')?.addEventListener('click', async () => {
                    const nameInput = formContainer.querySelector('#n') as HTMLInputElement;
                    const emailInput = formContainer.querySelector('#e') as HTMLInputElement;
                    const phoneInput = formContainer.querySelector('#p') as HTMLInputElement;
                    const symptomsInput = formContainer.querySelector('#s') as HTMLTextAreaElement;
                    
                    if (!nameInput.value || !emailInput.value) return;
                    
                    // PASS DATA TO VOICEFLOW
                    // Voiceflow API Step will insert this into Supabase
                    window.voiceflow?.chat.interact({
                      type: 'correct',
                      payload: { 
                        name: nameInput.value.trim(),
                        email: emailInput.value.trim().toLowerCase(),
                        phone_number: phoneInput.value.trim(),
                        symptoms: symptomsInput.value.trim()
                      }
                    });
                    
                    formContainer.innerHTML = "<p style='color: #4dabf7; text-align: center; padding: 20px;'>✓ Information Submitted</p>";
                  });
                
                  element.appendChild(formContainer);
                },
              }
            ],
          },
        });

        if (window.voiceflow.chat.onEnd) {
          window.voiceflow.chat.onEnd(() => onChatComplete());
        }
      }
    };

    document.head.appendChild(script);
    scriptLoaded.current = true;

    return () => {
      if (script.parentNode) script.parentNode.removeChild(script);
    };
  }, [onChatComplete]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
          <MessageSquare className="h-8 w-8 text-primary" />
        </div>
        <h1 className="text-2xl font-bold">HealthCare Assistant</h1>
        <p className="text-muted-foreground mt-2">Please chat with the assistant below to book your appointment.</p>
      </div>
    </div>
  );
}
