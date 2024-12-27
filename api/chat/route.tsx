import { NextResponse } from 'next/server';

const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${process.env.NEXT_PUBLIC_GEMINI_API_KEY}`;

export async function POST(req: Request) {
  try {
    const { messages } = await req.json();

    if (!process.env.NEXT_PUBLIC_GEMINI_API_KEY) {
      return NextResponse.json({ error: 'Gemini API key not configured' }, { status: 500 });
    }

    const userMessage = messages[messages.length - 1]?.content || '';

    const requestBody = {
      contents: [
        {
          parts: [
            {
              text: `You are a network design assistant. The user is asking about network requirements.
                     Current conversation: ${JSON.stringify(messages.slice(0, -1))}.
                     User's latest message: ${userMessage}.
                     Provide a helpful response to guide the user in specifying their network requirements.`
            }
          ]
        }
      ],
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 256
      }
    };

    const response = await fetch(GEMINI_API_URL, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Gemini API error: ${response.status} ${errorText}`);
      throw new Error(`Gemini API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();

    if (data.candidates && data.candidates[0] && data.candidates[0].content?.parts[0]?.text) {
      return NextResponse.json({ content: data.candidates[0].content.parts[0].text });
    } else {
      throw new Error('Invalid response from Gemini API');
    }
  } catch (error: unknown) {
    console.error('Error calling Gemini API:', error.message);
    return NextResponse.json({ error: 'Failed to generate response' }, { status: 500 });
  }
}