import OpenAI from "openai";

type DebateCandidate = { id: string; name: string };

let openai: OpenAI | null = null;

function getOpenAI(): OpenAI {
  if (!openai) {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error("OPENAI_API_KEY is not configured. Please set up OpenAI to enable AI debates.");
    }
    openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return openai;
}

export async function generateArgument(
  topic: string,
  personaName: string,
  personaTone: string,
  personaBias: string,
  previousArguments: string[],
  roundNumber: number
): Promise<string> {
  const systemPrompt = `You are ${personaName}, an AI debate participant with the following characteristics:
Tone: ${personaTone}
Ideological Bias: ${personaBias}

You are debating the topic: "${topic}"

Your goal is to make a compelling argument that reflects your tone and bias. Be persuasive, articulate, and engage with previous arguments when relevant. Keep your response focused and under 200 words.`;

  const conversationHistory = previousArguments.length > 0
    ? `\n\nPrevious arguments in this debate:\n${previousArguments.join("\n\n")}`
    : "";

  const userPrompt = `This is round ${roundNumber}. Present your argument for this debate.${conversationHistory}`;

  const response = await getOpenAI().chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    max_tokens: 512,
  });

  return response.choices[0].message.content || "I have no argument at this time.";
}

export async function judgeDebate(
  topic: string,
  personaAName: string,
  personaBName: string,
  allArguments: Array<{ personaName: string; personaId: string; content: string; roundNumber: number }>
): Promise<{ winnerId: string; judgmentSummary: string }> {
  const debateTranscript = allArguments
    .map((arg) => `**Round ${arg.roundNumber} - ${arg.personaName}:**\n${arg.content}`)
    .join("\n\n");

  const systemPrompt = `You are an expert debate judge with deep knowledge of rhetoric, logic, and persuasive argumentation. You evaluate debates objectively based on:
- Strength and clarity of arguments
- Use of evidence and logical reasoning
- Engagement with opposing viewpoints
- Consistency and coherence
- Persuasiveness and impact

Your role is to analyze the complete debate and declare a winner with detailed reasoning.`;

  const userPrompt = `Please judge this debate on the topic: "${topic}"

**Debaters:**
- ${personaAName}
- ${personaBName}

**Full Debate Transcript:**
${debateTranscript}

Analyze both sides carefully and provide:
1. A clear declaration of the winner (${personaAName} or ${personaBName})
2. A detailed summary (3-5 paragraphs) explaining your reasoning, highlighting key strengths and weaknesses of each debater

Format your response exactly as:
WINNER: [the exact winning debater name, with no punctuation or commentary]
JUDGMENT: [Your detailed analysis]`;

  const completion = await getOpenAI().chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    max_tokens: 1024,
  });

  const response = completion.choices[0].message.content || "";
  const personaAId = allArguments.find(a => a.personaName === personaAName)?.personaId || "";
  const personaBId = allArguments.find(a => a.personaName === personaBName)?.personaId || "";

  return parseJudgmentResponse(response, [
    { id: personaAId, name: personaAName },
    { id: personaBId, name: personaBName },
  ]);
}

function normalizeName(value: string): string {
  return value.trim().replace(/\s+/g, " ").toLocaleLowerCase();
}

export function parseJudgmentResponse(
  response: string,
  candidates: [DebateCandidate, DebateCandidate],
): { winnerId: string; judgmentSummary: string } {
  const winnerMatch = response.match(/^WINNER:\s*(.+?)\s*$/im);
  const judgmentMatch = response.match(/^JUDGMENT:\s*([\s\S]+)$/im);
  const winnerName = winnerMatch?.[1] ?? "";
  const judgmentSummary = judgmentMatch?.[1].trim() ?? "";
  const normalizedWinner = normalizeName(winnerName);
  const matchingCandidates = candidates.filter((candidate) => normalizeName(candidate.name) === normalizedWinner);

  if (matchingCandidates.length !== 1 || !matchingCandidates[0].id) {
    throw new Error("OpenAI judge returned an unrecognized winner");
  }
  if (judgmentSummary.length === 0) {
    throw new Error("OpenAI judge returned an empty judgment");
  }

  return { winnerId: matchingCandidates[0].id, judgmentSummary };
}
