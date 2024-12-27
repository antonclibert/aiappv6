"use client";

import React, { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, Network } from "lucide-react";

// Enhanced interface to include more specific network design data
interface NetworkDesignContext {
  questions: string[];
  collectedInfo: Record<string, string>;
  stage: 'initial' | 'gathering' | 'recommending';
}

interface Message {
  role: "user" | "assistant";
  content: string;
  id: string;
}

interface ChatInterfaceProps {
  onNetworkDesignGenerated: (data: any) => void;
}

export function ChatInterface({ onNetworkDesignGenerated }: ChatInterfaceProps) {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content: "Welcome! I'm your network design assistant. I'll help you create a comprehensive network infrastructure plan. Let's start by understanding your business and technical requirements.",
      id: `assistant-${Date.now()}`,
    },
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [context, setContext] = useState<NetworkDesignContext>({
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
  });
  const scrollAreaRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollAreaRef.current) {
      scrollAreaRef.current.scrollTo({
        top: scrollAreaRef.current.scrollHeight,
        behavior: "smooth",
      });
    }
  }, [messages]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedInput = input.trim();
    if (!trimmedInput) return;

    // Create user message with unique ID
    const userMessage: Message = {
      role: "user",
      content: trimmedInput,
      id: `user-${Date.now()}`,
    };

    // Update messages and clear input
    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);

    try {
      // Prepare the request payload
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messages: [...messages, userMessage],
          context: context
        }),
      });

      // Handle network or server errors
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      // Parse the response
      const data = await response.json();

      // Validate the response
      if (data.content) {
        const assistantMessage: Message = {
          role: "assistant",
          content: data.content,
          id: `assistant-${Date.now()}`,
        };

        // Update messages
        setMessages((prev) => [...prev, assistantMessage]);

        // Update context from the response
        if (data.context) {
          setContext(data.context);

          // Check if we've reached the recommendation stage
          if (data.context.stage === 'recommending') {
            onNetworkDesignGenerated(data.context.collectedInfo);
          }
        }

        // Suggest next question if available
        if (context.questions.length > 0) {
          const nextQuestion = context.questions[0];
          setMessages((prev) => [...prev, {
            role: "assistant",
            content: `Could you provide more information about: ${nextQuestion}`,
            id: `assistant-${Date.now()}`
          }]);
        }
      } else {
        throw new Error("Invalid response from AI");
      }
    } catch (error) {
      console.error("Error generating response:", error);

      // Add error message
      const errorMessage: Message = {
        role: "assistant",
        content: "I apologize, but I encountered an error. Please try again.",
        id: `error-${Date.now()}`,
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      // Ensure loading state is reset
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full">
      <ScrollArea className="flex-grow mb-4 px-2" ref={scrollAreaRef}>
        <div className="space-y-2">
          {messages.map((message) => (
            <Card
              key={message.id}
              className={`${
                message.role === "user"
                  ? "bg-blue-50 border-blue-200"
                  : "bg-gray-50 border-gray-200"
              }`}
            >
              <CardContent className="p-3 flex items-center">
                {message.role === "assistant" && (
                  <Network className="mr-2 h-5 w-5 text-gray-500" />
                )}
                <p
                  className={`text-sm ${
                    message.role === "user" ? "text-blue-800" : "text-gray-800"
                  }`}
                >
                  {message.content}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      </ScrollArea>
      <form onSubmit={handleSubmit} className="flex space-x-2">
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={`Describe your network requirements${context.questions.length > 0 ? ` (Next: ${context.questions[0]})` : ''}...`}
          disabled={isLoading}
          className="flex-grow"
        />
        <Button type="submit" disabled={isLoading} className="min-w-[100px]">
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Sending...
            </>
          ) : (
            "Send"
          )}
        </Button>
      </form>
    </div>
  );
}