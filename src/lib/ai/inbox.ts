import Anthropic from '@anthropic-ai/sdk';

export interface ReplyAnalysis {
  sentiment: 'positive' | 'neutral' | 'negative' | 'interested' | 'not_interested';
  priority_score: number;
  ai_suggested_response: string;
  ai_response_strategy: string;
}

export async function analyzeJournalistReply(
  replyText: string,
  journalistName: string,
  mediaOutlet: string | null,
  campaignContext: string
): Promise<ReplyAnalysis | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;

  const anthropic = new Anthropic({ apiKey });

  const message = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 800,
    messages: [
      {
        role: 'user',
        content: `Tu es un expert en relations presse. Analyse la réponse de ce journaliste à un communiqué de presse.

**Contexte campagne :** ${campaignContext}
**Journaliste :** ${journalistName}${mediaOutlet ? ` (${mediaOutlet})` : ''}
**Réponse reçue :**
${replyText.slice(0, 2000)}

Réponds UNIQUEMENT avec un objet JSON valide (sans markdown, sans backticks) :
{
  "sentiment": "positive|neutral|negative|interested|not_interested",
  "priority_score": <0-100>,
  "ai_suggested_response": "<réponse suggérée en 2-3 phrases professionnelles>",
  "ai_response_strategy": "<stratégie recommandée en 1-2 phrases>"
}

Règles de scoring :
- 80-100 : journaliste très intéressé / media à forte audience
- 60-79 : intérêt modéré ou demande d'info complémentaire
- 40-59 : réponse neutre ou polie
- 0-39 : refus clair ou pas intéressé`,
      },
    ],
  });

  const raw = message.content[0].type === 'text' ? message.content[0].text.trim() : '';
  const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
  const parsed = JSON.parse(cleaned) as ReplyAnalysis;
  return parsed;
}
