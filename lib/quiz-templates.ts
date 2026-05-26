/**
 * Quiz Templates Module
 *
 * Pre-built quiz configurations that merchants can use as starting points.
 * Separates **pure template definitions** (zero side effects) from the
 * **seed function** that persists them via a Prisma transaction.
 *
 * Architecture:
 *   create*Template()  → pure, returns QuizTemplate (plain object)
 *   seedQuizFromTemplate() → impure, creates DB records in a transaction
 */

import type { PrismaClient } from "@prisma/client";
import { generateQuizKey } from "./quiz-service";

// ---------------------------------------------------------------------------
// Template Types
// ---------------------------------------------------------------------------

/** A single answer within a template question. */
export interface AnswerTemplate {
  title: string;
  description?: string;
  image?: string;
  /** Points value (used by Points logic). */
  points?: number;
}

/** A question template with its answer options. */
export interface QuestionTemplate {
  type: string;
  title: string;
  subtitle?: string;
  answers: AnswerTemplate[];
}

/** Reference to a question & answer by index for building basic-logic paths. */
export interface PathAnswerRef {
  questionIndex: number;
  answerIndex: number;
}

/** A result outcome template, optionally with path rules or point ranges. */
export interface ResultTemplate {
  title: string;
  description?: string;
  outcomeType?: string;
  outcomeData?: Record<string, unknown>;
  /** Points-logic lower bound (inclusive). */
  pointsFrom?: number;
  /** Points-logic upper bound (inclusive). */
  pointsTo?: number;
  /** Basic-logic path answer references. */
  pathAnswers?: PathAnswerRef[];
  /** Basic-logic operator for the path ("AND" | "OR"). */
  logicOperator?: "AND" | "OR";
}

/** Complete quiz template ready for seeding. */
export interface QuizTemplate {
  name: string;
  logicType: string;
  questions: QuestionTemplate[];
  results: ResultTemplate[];
}

// ---------------------------------------------------------------------------
// Template 1: Skincare Routine Builder
// ---------------------------------------------------------------------------

/** Pure: 4-question skincare quiz with basic logic matching skin type to routine. */
export function createSkincareTemplate(): QuizTemplate {
  return {
    name: "Skincare Routine Builder",
    logicType: "basic",
    questions: [
      {
        type: "radio",
        title: "What's your skin type?",
        subtitle: "Choose the option that best describes your skin.",
        answers: [
          { title: "Dry", description: "Feels tight, flaky, or rough" },
          { title: "Oily", description: "Shiny, prone to breakouts" },
          { title: "Combination", description: "Oily T-zone, dry cheeks" },
          { title: "Normal / Sensitive", description: "Balanced or easily irritated" },
        ],
      },
      {
        type: "radio",
        title: "What's your main skin concern?",
        answers: [
          { title: "Aging & Wrinkles" },
          { title: "Acne & Breakouts" },
          { title: "Dullness & Uneven Tone" },
          { title: "Redness & Sensitivity" },
        ],
      },
      {
        type: "radio",
        title: "What's your current routine?",
        answers: [
          { title: "Just cleanser" },
          { title: "Basic (cleanser + moisturizer)" },
          { title: "Intermediate (adds serum)" },
          { title: "Advanced (multi-step)" },
        ],
      },
      {
        type: "radio",
        title: "What's your monthly skincare budget?",
        answers: [
          { title: "Under $30" },
          { title: "$30-$60" },
          { title: "$60-$100" },
          { title: "$100+" },
        ],
      },
    ],
    results: [
      {
        title: "Dry Skin Routine",
        description:
          "Focus on hydration and barrier repair. Use cream cleansers, hyaluronic acid serums, and rich moisturizers with ceramides.",
        outcomeType: "text",
        pathAnswers: [{ questionIndex: 0, answerIndex: 0 }],
        logicOperator: "AND",
      },
      {
        title: "Oily Skin Routine",
        description:
          "Balance oil production without stripping. Gel cleansers, niacinamide, and lightweight oil-free moisturizers work best.",
        outcomeType: "text",
        pathAnswers: [{ questionIndex: 0, answerIndex: 1 }],
        logicOperator: "AND",
      },
      {
        title: "Combination Routine",
        description:
          "A balanced approach with gentle cleansing, targeted treatments for the T-zone, and medium-weight hydration.",
        outcomeType: "text",
        pathAnswers: [
          { questionIndex: 0, answerIndex: 2 },
          { questionIndex: 0, answerIndex: 3 },
        ],
        logicOperator: "OR",
      },
    ],
  };
}

// ---------------------------------------------------------------------------
// Template 2: Coffee Finder
// ---------------------------------------------------------------------------

/** Pure: 3-question coffee quiz with basic logic matching roast to result. */
export function createCoffeeTemplate(): QuizTemplate {
  return {
    name: "Coffee Finder",
    logicType: "basic",
    questions: [
      {
        type: "radio",
        title: "What roast level do you prefer?",
        answers: [
          { title: "Light", description: "Bright acidity, floral notes" },
          { title: "Medium", description: "Balanced body and acidity" },
          { title: "Medium-Dark", description: "Richer body, subtle bitterness" },
          { title: "Dark", description: "Bold, smoky, low acidity" },
        ],
      },
      {
        type: "radio",
        title: "Which flavor profile appeals most?",
        answers: [
          { title: "Fruity & Floral" },
          { title: "Chocolate & Nutty" },
          { title: "Balanced & Smooth" },
          { title: "Bold & Smoky" },
        ],
      },
      {
        type: "radio",
        title: "How do you brew your coffee?",
        answers: [
          { title: "Pour Over", description: "Clean, highlights origin flavors" },
          { title: "French Press", description: "Full-bodied, rich texture" },
          { title: "Espresso Machine", description: "Concentrated, intense" },
          { title: "Drip Machine", description: "Convenient, consistent" },
        ],
      },
    ],
    results: [
      {
        title: "Light & Bright",
        description:
          "Ethiopian and Kenyan single-origins shine here. Look for washed-process beans with tasting notes of citrus, berry, and jasmine.",
        outcomeType: "text",
        outcomeData: {
          recommendedProducts: [
            "Ethiopian Yirgacheffe",
            "Kenyan AA",
            "Light Roast Sample Pack",
          ],
        },
        pathAnswers: [{ questionIndex: 0, answerIndex: 0 }],
        logicOperator: "AND",
      },
      {
        title: "Dark & Bold",
        description:
          "Sumatran and French roasts deliver the intensity you crave. Expect notes of dark chocolate, toasted nuts, and a smoky finish.",
        outcomeType: "text",
        outcomeData: {
          recommendedProducts: [
            "Sumatran Dark Roast",
            "French Roast Blend",
            "Dark Roast Espresso",
          ],
        },
        pathAnswers: [{ questionIndex: 0, answerIndex: 3 }],
        logicOperator: "AND",
      },
      {
        title: "Balanced Medium",
        description:
          "Colombian and Costa Rican coffees offer the perfect middle ground: smooth body, gentle acidity, and versatile for any brew method.",
        outcomeType: "text",
        outcomeData: {
          recommendedProducts: [
            "Colombian Supremo",
            "Costa Rican Tarrazú",
            "House Blend",
          ],
        },
        pathAnswers: [{ questionIndex: 0, answerIndex: 1 }],
        logicOperator: "AND",
      },
      {
        title: "Espresso Lover",
        description:
          "You want intensity and crema. Italian and espresso blends with a medium-dark roast profile are your go-to.",
        outcomeType: "text",
        outcomeData: {
          recommendedProducts: [
            "Espresso Blend",
            "Italian Roast",
            "Single-Origin Espresso",
          ],
        },
        pathAnswers: [{ questionIndex: 2, answerIndex: 2 }],
        logicOperator: "AND",
      },
    ],
  };
}

// ---------------------------------------------------------------------------
// Template 3: Supplement Quiz
// ---------------------------------------------------------------------------

/** Pure: 5-question supplement quiz with Points logic and score ranges. */
export function createSupplementTemplate(): QuizTemplate {
  return {
    name: "Supplement Quiz",
    logicType: "points",
    questions: [
      {
        type: "radio",
        title: "What's your primary health goal?",
        subtitle: "Choose the one that matters most right now.",
        answers: [
          { title: "General wellness & immunity", points: 1 },
          { title: "Build muscle & strength", points: 3 },
          { title: "Mental focus & clarity", points: 4 },
          { title: "Better sleep & stress relief", points: 2 },
        ],
      },
      {
        type: "radio",
        title: "What best describes your diet?",
        answers: [
          { title: "Balanced omnivore", points: 1 },
          { title: "High-protein focused", points: 3 },
          { title: "Plant-based / vegan", points: 4 },
          { title: "Intermittent fasting", points: 2 },
        ],
      },
      {
        type: "radio",
        title: "How active are you?",
        answers: [
          { title: "Lightly active (walks only)", points: 1 },
          { title: "Moderate (3-4x/week)", points: 2 },
          { title: "Very active (5-6x/week)", points: 3 },
          { title: "Intense training / athlete", points: 4 },
        ],
      },
      {
        type: "radio",
        title: "What supplement format do you prefer?",
        answers: [
          { title: "Capsules / tablets", points: 1 },
          { title: "Powders & shakes", points: 3 },
          { title: "Gummies", points: 2 },
          { title: "Liquids & tinctures", points: 4 },
        ],
      },
      {
        type: "radio",
        title: "What's your monthly supplement budget?",
        answers: [
          { title: "Under $30", points: 1 },
          { title: "$30-$60", points: 2 },
          { title: "$60-$100", points: 3 },
          { title: "$100+", points: 4 },
        ],
      },
    ],
    results: [
      {
        title: "General Wellness",
        description:
          "A foundational stack for everyday health: multivitamin, vitamin D, omega-3, and a probiotic to cover your bases.",
        outcomeType: "text",
        pointsFrom: 5,
        pointsTo: 9,
      },
      {
        title: "Athletic Performance",
        description:
          "Built for gains: whey or plant protein, creatine monohydrate, BCAAs, and beta-alanine to fuel your workouts and recovery.",
        outcomeType: "text",
        pointsFrom: 10,
        pointsTo: 14,
      },
      {
        title: "Cognitive Focus",
        description:
          "Sharpen your mind: lion's mane mushroom, L-theanine, omega-3 (high DHA), and a nootropic blend for sustained mental clarity.",
        outcomeType: "text",
        pointsFrom: 15,
        pointsTo: 17,
      },
      {
        title: "Sleep & Recovery",
        description:
          "Rest and repair: magnesium glycinate, ashwagandha, melatonin (low dose), and a recovery amino blend for deep restorative sleep.",
        outcomeType: "text",
        pointsFrom: 18,
        pointsTo: 20,
      },
    ],
  };
}

// ---------------------------------------------------------------------------
// Seed Function
// ---------------------------------------------------------------------------

/**
 * Persist a QuizTemplate to the database inside a single Prisma transaction.
 *
 * Creates the quiz, all questions with their answers, all results, and for
 * basic-logic templates — all result paths with their path-answer references.
 * Uses indices from the template to cross-reference records within the txn.
 *
 * @returns An object containing the newly created quiz's ID.
 */
export async function seedQuizFromTemplate(
  prisma: PrismaClient,
  storeId: string,
  template: QuizTemplate,
): Promise<{ quizId: string }> {
  return prisma.$transaction(async (tx) => {
    // 1. Create quiz
    const quiz = await tx.quiz.create({
      data: {
        storeId,
        name: template.name,
        key: generateQuizKey(template.name),
        logicType: template.logicType,
      },
    });

    // 2. Create questions (collect IDs by index)
    const questionIds: string[] = [];
    for (const q of template.questions) {
      const question = await tx.question.create({
        data: {
          quizId: quiz.id,
          type: q.type,
          title: q.title,
          subtitle: q.subtitle,
          order: questionIds.length,
        },
      });
      questionIds.push(question.id);
    }

    // 3. Create answers (collect IDs by [questionIndex][answerIndex])
    const answerIds: Map<number, string[]> = new Map();
    for (let qi = 0; qi < template.questions.length; qi++) {
      const ids: string[] = [];
      for (let ai = 0; ai < template.questions[qi].answers.length; ai++) {
        const a = template.questions[qi].answers[ai];
        const answer = await tx.answer.create({
          data: {
            questionId: questionIds[qi],
            title: a.title,
            description: a.description,
            image: a.image,
            order: ai,
            points: a.points ?? 0,
          },
        });
        ids.push(answer.id);
      }
      answerIds.set(qi, ids);
    }

    // 4. Create results (collect IDs by index)
    const resultIds: string[] = [];
    for (let ri = 0; ri < template.results.length; ri++) {
      const r = template.results[ri];
      const result = await tx.result.create({
        data: {
          quizId: quiz.id,
          title: r.title,
          description: r.description,
          outcomeType: r.outcomeType ?? "text",
          outcomeData: JSON.stringify(r.outcomeData ?? {}),
          order: ri,
          pointsFrom: r.pointsFrom,
          pointsTo: r.pointsTo,
        },
      });
      resultIds.push(result.id);
    }

    // 5. Create result paths (basic logic only)
    if (template.logicType === "basic") {
      for (let ri = 0; ri < template.results.length; ri++) {
        const r = template.results[ri];
        if (r.pathAnswers && r.pathAnswers.length > 0) {
          const path = await tx.resultPath.create({
            data: {
              quizId: quiz.id,
              resultId: resultIds[ri],
              logicOperator: r.logicOperator ?? "AND",
              order: ri,
            },
          });

          for (const pa of r.pathAnswers) {
            const answerId = answerIds.get(pa.questionIndex)?.[pa.answerIndex];
            if (answerId) {
              await tx.resultPathAnswer.create({
                data: {
                  resultPathId: path.id,
                  questionId: questionIds[pa.questionIndex],
                  answerId,
                },
              });
            }
          }
        }
      }
    }

    return { quizId: quiz.id };
  });
}
