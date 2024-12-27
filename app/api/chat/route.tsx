import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

// Define a structured interface for network design requirements
interface NetworkDesignContext {
  questions: string[];
  collectedInfo: Record<string, string>;
  stage: 'initial' | 'gathering' | 'recommending';
}

export async function POST(req: Request) {
  try {
    // Validate API key
    if (!process.env.NEXT_PUBLIC_GEMINI_API_KEY) {
      return NextResponse.json({ error: 'Gemini API key not configured' }, { status: 500 });
    }

    // Initialize the Google Generative AI client
    const genAI = new GoogleGenerativeAI(process.env.NEXT_PUBLIC_GEMINI_API_KEY);

    // Parse incoming request
    const { messages, context } = await req.json();

    // Extract the latest user message
    const userMessage = messages[messages.length - 1]?.content || '';

    // Default network design context
    const defaultContext: NetworkDesignContext = {
      questions: [
        'What is your company size?',
        'What industry are you in?',
        'How many physical locations do you have?',
        'What is your required network uptime?',
        'What are your critical business applications?',
        'Estimated number of network users?',
        'What are your primary network security concerns?'
      ],
      collectedInfo: {},
      stage: 'initial'
    };

    // Merge or use provided context
    const networkContext = context ? { ...defaultContext, ...context } : defaultContext;

    // Construct comprehensive system prompt
    const systemPrompt = `
    You are an expert network engineer assistant. Your goal is to help design a comprehensive network infrastructure.

    CURRENT CONTEXT:
    - Collected Information: ${JSON.stringify(networkContext.collectedInfo)}
    - Pending Questions: ${networkContext.questions.join(', ')}

    DESIGN GUIDELINES:
    1. Ask clarifying questions to gather complete network requirements
    2. Provide detailed, practical recommendations
    3. Consider scalability, security, and budget constraints
    4. Give concise, actionable insights

    INTERACTION STRATEGY:
    - If information is incomplete, ask specific follow-up questions
    - Summarize collected information periodically
    - Offer initial design recommendations when sufficient data is available

    RESPONSE FORMAT:
    - Clear, professional language
    - Technical but accessible explanations
    - Prioritize user's business objectives
    `;

    // Construct chat history with system context
    const chatHistory = [
      {
        role: 'user',
        parts: [{ text: systemPrompt }]
      },
      ...messages.map((msg: any) => ({
        role: msg.role === 'user' ? 'user' : 'model',
        parts: [{ text: msg.content }],
      }))
    ];

    // Configure Gemini model
    const model = genAI.getGenerativeModel({
      model: "gemini-pro",
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 512,  // Increased for more detailed responses
        topK: 40,
        topP: 0.9
      },
      safetySettings: [
        {
          category: 'HARM_CATEGORY_HARASSMENT',
          threshold: 'BLOCK_NONE'
        },
        {
          category: 'HARM_CATEGORY_HATE_SPEECH',
          threshold: 'BLOCK_NONE'
        }
      ]
    });

    // Start chat session
    const chat = model.startChat({
      history: chatHistory,
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 512
      }
    });

    // Send the latest user message
    const result = await chat.sendMessage(userMessage);
    const response = await result.response;
    const text = await response.text();

    // Basic data extraction for network design
    const extractedData = extractNetworkDesignData(text, networkContext);

    // Return response with potential network design data
    return NextResponse.json({ 
      content: text,
      context: {
        ...networkContext,
        ...extractedData
      }
    });

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('Error calling Gemini API:', errorMessage);

    return NextResponse.json(
      { error: 'Failed to generate response', details: errorMessage },
      { status: 500 }
    );
  }
}

// Helper function to extract network design data
function extractNetworkDesignData(response: string, context: NetworkDesignContext) {
  const extractedData: Record<string, string> = {};

  // Mapping of keywords to network design attributes
  const attributeMapping = {
    'company size': 'companySize',
    'industry': 'industryType',
    'locations': 'locations',
    'uptime': 'requiredUptime',
    'users': 'estimatedUsers',
    'applications': 'criticalApplications',
    'security': 'securityRequirements'
  };

  // Basic extraction logic
  Object.entries(attributeMapping).forEach(([keyword, attribute]) => {
    const regex = new RegExp(`${keyword}:\\s*([^\\n]+)`, 'i');
    const match = response.match(regex);
    if (match) {
      extractedData[attribute] = match[1].trim();
    }
  });

  // Update collected information
  return {
    collectedInfo: {
      ...context.collectedInfo,
      ...extractedData
    },
    // Remove collected attributes from questions
    questions: context.questions.filter(q => 
      !Object.keys(extractedData).some(attr => 
        q.toLowerCase().includes(attr.toLowerCase())
      )
    ),
    // Update stage based on collected information
    stage: Object.keys(extractedData).length > 3 ? 'recommending' : 'gathering'
  };
}