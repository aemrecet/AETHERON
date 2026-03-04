const API_BASE = '';

export const askGemini = async (prompt: string, context: string, conversationHistory?: { role: string; content: string }[]): Promise<string> => {
  try {
    const messages = conversationHistory || [{ role: 'user', content: prompt }];

    const response = await fetch(`${API_BASE}/api/ai/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages,
        marketContext: context
      })
    });

    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    return data.reply || "I couldn't generate a response at this time.";
  } catch (error) {
    console.error("AI Chat Error:", error);
    return "Sorry, I'm having trouble connecting to the AI engine right now. Please try again.";
  }
};

export const fetchEconomicCalendar = async () => {
  try {
    const response = await fetch(`${API_BASE}/api/economic-calendar`);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
  } catch (error) {
    console.error("Economic Calendar Error:", error);
    return { events: [] };
  }
};
