import {
  addDays,
  addMinutes,
  differenceInCalendarDays,
  parseISO,
  setHours,
  setMinutes,
  startOfDay,
  subDays,
} from 'date-fns';
import type {
  CategoryId,
  CoachPlan,
  GeneratedMilestone,
  Goal,
  Milestone,
  PlanDraft,
  Priority,
} from '@/types';
import { CATEGORIES, PRIORITY_META } from './catalog';
import { daysUntil, fmtDateShort, isOverdue, parse, uid } from './dates';
import { fmtDuration } from './utils';

type Role = 'kickoff' | 'foundation' | 'build' | 'review' | 'logistics' | 'rehearse' | 'final' | 'day';

interface RoleTask {
  title: string;
  description: string;
  weight: number;
}

type Library = Record<Role, RoleTask>;

const LIBRARY: Record<CategoryId, Library> = {
  exams: {
    kickoff: {
      title: 'Map the syllabus and mark weak spots',
      description: 'List every topic, rate your confidence 1–5, and pull the three weakest into this plan.',
      weight: 0.8,
    },
    foundation: {
      title: 'Build active-recall notes for the core units',
      description: 'Condense the first half of the syllabus into questions you can test yourself on.',
      weight: 1,
    },
    build: {
      title: 'Deep-work block on the hardest topics',
      description: 'Two focused sessions on your lowest-confidence units. Practice problems over rereading.',
      weight: 1.25,
    },
    review: {
      title: 'Sit a timed practice paper',
      description: 'Work under exam conditions, then mark it honestly and log every recurring mistake.',
      weight: 1.2,
    },
    logistics: {
      title: 'Prepare the exam-day kit and travel plan',
      description: 'ID, stationery, water, route and arrival buffer. Decide the night-before routine now.',
      weight: 0.6,
    },
    rehearse: {
      title: 'Rapid-fire recall sweep',
      description: 'Flashcards and past-paper questions across every unit. Stop learning anything new.',
      weight: 1.1,
    },
    final: {
      title: 'Light review, then an early night',
      description: 'One calm summary pass. Sleep is part of the preparation, not a break from it.',
      weight: 0.5,
    },
    day: {
      title: 'Exam day: arrive early, stay calm',
      description: 'Eat, hydrate, and arrive with a buffer. Read the whole paper before writing a word.',
      weight: 0.5,
    },
  },
  work: {
    kickoff: {
      title: 'Clarify the brief and decision-makers',
      description: 'Write the outcome in one sentence, list the approvers, and confirm the definition of done.',
      weight: 0.7,
    },
    foundation: {
      title: 'Assemble source material and an outline',
      description: 'Gather inputs, data and prior work. Draft the skeleton before polishing anything.',
      weight: 0.9,
    },
    build: {
      title: 'Produce the first complete draft',
      description: 'Build it end to end, even if rough. Mark gaps instead of stopping to perfect every line.',
      weight: 1.3,
    },
    review: {
      title: 'Review with the most critical stakeholder',
      description: 'Walk through the draft, capture objections, and lock the final scope in writing.',
      weight: 1,
    },
    logistics: {
      title: 'Chase dependencies and firm up handoffs',
      description: 'Approvals, file access and anything that could block delivery. Give people a deadline.',
      weight: 0.6,
    },
    rehearse: {
      title: 'Rehearse the delivery out loud',
      description: 'Run it once with a timer, then cut anything that does not earn its place.',
      weight: 0.9,
    },
    final: {
      title: 'Final QA and send-ready check',
      description: 'Proof, numbers, links and permissions. Draft the covering note before the last minute.',
      weight: 0.7,
    },
    day: {
      title: 'Deliver, then capture the outcome',
      description: 'Submit early, confirm receipt, and send a short summary of decisions and next steps.',
      weight: 0.5,
    },
  },
  project: {
    kickoff: {
      title: 'Lock scope and define what done means',
      description: 'Acceptance criteria, constraints and an out-of-scope list. Get one written confirmation.',
      weight: 0.7,
    },
    foundation: {
      title: 'Set architecture, environments and tracking',
      description: 'Decide structure and conventions early. Create the board you will actually maintain.',
      weight: 1,
    },
    build: {
      title: 'Ship the core vertical slice',
      description: 'One complete flow working end to end beats five half-built features. Cut ruthlessly.',
      weight: 1.4,
    },
    review: {
      title: 'Integration and edge-case pass',
      description: 'Test the seams, empty states, permissions and the one path you keep avoiding.',
      weight: 1.1,
    },
    logistics: {
      title: 'Clear blockers and external dependencies',
      description: 'API keys, accesses, reviews and sign-offs. Escalate anything with a lead time.',
      weight: 0.6,
    },
    rehearse: {
      title: 'Demo rehearsal with real data',
      description: 'Run the story a stakeholder will see. Prepare a fallback if the demo fails live.',
      weight: 0.9,
    },
    final: {
      title: 'Release checklist and rollback plan',
      description: 'Backup, migration, monitoring and a human who knows how to revert. Freeze new scope.',
      weight: 0.8,
    },
    day: {
      title: 'Launch, monitor, and announce',
      description: 'Deploy early in the day, watch the dashboards, and tell people it is live with context.',
      weight: 0.6,
    },
  },
  birthday: {
    kickoff: {
      title: 'Set the guest list and the mood',
      description: 'Who should be there, and what should the day feel like? Choose one clear vibe.',
      weight: 0.5,
    },
    foundation: {
      title: 'Book the table, venue or experience',
      description: 'Secure the thing that cannot be fixed later. Confirm headcount and timing.',
      weight: 0.7,
    },
    build: {
      title: 'Plan food, cake and music',
      description: 'Keep it simple and personal. Order the cake early and build a short playlist.',
      weight: 0.8,
    },
    review: {
      title: 'Confirm RSVPs and dietary needs',
      description: 'Chase the quiet ones. Share a final headcount with wherever you are hosting.',
      weight: 0.5,
    },
    logistics: {
      title: 'Gather gifts, cards and decorations',
      description: 'Write the card by hand. Buy batteries, tape and the small things you always forget.',
      weight: 0.6,
    },
    rehearse: {
      title: 'Prepare the surprise or the speech',
      description: 'Say it out loud once. Short and sincere beats long and perfect.',
      weight: 0.6,
    },
    final: {
      title: 'Day-before confirmations',
      description: 'Venue, cake, transport and the one person who can handle a last-minute problem.',
      weight: 0.4,
    },
    day: {
      title: 'Celebrate and capture the moment',
      description: 'Put the phone down for the important parts. Ask someone to take the photo you will want.',
      weight: 0.4,
    },
  },
  wedding: {
    kickoff: {
      title: 'Lock the vision, budget and guest count',
      description: 'Agree the three things that matter most. Everything else is negotiable.',
      weight: 0.8,
    },
    foundation: {
      title: 'Confirm venue, date and core vendors',
      description: 'Venue, photography, food and attire. Get contracts and payment schedules in one folder.',
      weight: 1.1,
    },
    build: {
      title: 'Outfits, rings and menu tasting',
      description: 'Book the fittings and alterations early. Confirm the menu and the drinks you actually like.',
      weight: 1,
    },
    review: {
      title: 'Seating plan and run-of-show',
      description: 'Place people with care. Write the ceremony and reception timeline minute by minute.',
      weight: 0.9,
    },
    logistics: {
      title: 'Final vendor payments and confirmations',
      description: 'Check every arrival time, balance and contact. Send the schedule to everyone involved.',
      weight: 0.7,
    },
    rehearse: {
      title: 'Ceremony rehearsal',
      description: 'Walk the order, the music cues and the handing-over of rings. Breathe.',
      weight: 0.6,
    },
    final: {
      title: 'Pack the day-of kit',
      description: 'Rings, vows, touch-up kit, chargers, snacks and a steamer. Give the kit to one person.',
      weight: 0.5,
    },
    day: {
      title: 'Marry your person',
      description: 'Eat something. Hold hands. Let the schedule go if the moment asks you to.',
      weight: 0.4,
    },
  },
  festival: {
    kickoff: {
      title: 'Decide where and with whom',
      description: 'Confirm the plan before logistics take over. One message to the group with clear dates.',
      weight: 0.5,
    },
    foundation: {
      title: 'Book travel and the stay',
      description: 'Prices climb as the date nears. Lock refundable options first.',
      weight: 0.8,
    },
    build: {
      title: 'Plan gifts, outfits and the menu',
      description: 'Write the list you will actually shop from. Order anything that ships slowly.',
      weight: 0.9,
    },
    review: {
      title: 'Confirm guests and contributions',
      description: 'Remove the guesswork: who is bringing what, and who needs a place to stay.',
      weight: 0.5,
    },
    logistics: {
      title: 'Buy ingredients and decorations',
      description: 'Shop the non-perishables early. Check the lights, plates and serving dishes.',
      weight: 0.7,
    },
    rehearse: {
      title: 'Prep what can be made ahead',
      description: 'Cook, freeze and label. Clean the house the day before, not the hour before.',
      weight: 0.8,
    },
    final: {
      title: 'Set the table and charge the cameras',
      description: 'Create one calm hour for the finishing touches. Layout checklist on paper.',
      weight: 0.5,
    },
    day: {
      title: 'Host and enjoy the day',
      description: 'Delegate the refills. The best host is a present one.',
      weight: 0.4,
    },
  },
  travel: {
    kickoff: {
      title: 'Lock dates, route and a realistic budget',
      description: 'Agree the non-negotiables and the one splurge. Check passport validity now.',
      weight: 0.6,
    },
    foundation: {
      title: 'Book transport and stays',
      description: 'Confirm cancellation terms and the time zone on every confirmation email.',
      weight: 0.9,
    },
    build: {
      title: 'Build a loose day-by-day itinerary',
      description: 'Two anchors a day, with white space between them. Save addresses offline.',
      weight: 0.8,
    },
    review: {
      title: 'Documents, visas and insurance',
      description: 'Scans in the cloud, physical copies in the bag, and an emergency contact written down.',
      weight: 0.6,
    },
    logistics: {
      title: 'Reservations, transfers and connectivity',
      description: 'Airport transfer, eSIM and the first meal planned for arrival day.',
      weight: 0.7,
    },
    rehearse: {
      title: 'Pack and weigh the bags',
      description: 'Lay everything out, then remove a third. Keep chargers and medication in the cabin bag.',
      weight: 0.6,
    },
    final: {
      title: 'Check in, get cash, download maps',
      description: 'Screenshot every booking. Set two alarms for departure morning.',
      weight: 0.4,
    },
    day: {
      title: 'Depart unhurried',
      description: 'Leave a buffer for traffic. You are allowed to enjoy the journey.',
      weight: 0.3,
    },
  },
  fitness: {
    kickoff: {
      title: 'Baseline: measure and set the target',
      description: 'Record where you are today. Choose one number that will define progress.',
      weight: 0.6,
    },
    foundation: {
      title: 'Build the weekly training block',
      description: 'Blocks you can repeat on a bad week. Schedule recovery before you schedule intensity.',
      weight: 0.9,
    },
    build: {
      title: 'Progressive overload block',
      description: 'Add a little each week. Track sets, reps and how the effort actually felt.',
      weight: 1.4,
    },
    review: {
      title: 'Re-test and adjust the plan',
      description: 'Compare against the baseline. If something hurts, change the movement, not the goal.',
      weight: 0.8,
    },
    logistics: {
      title: 'Kit, nutrition and recovery',
      description: 'Prep meals for the busiest days and lay out your kit the night before.',
      weight: 0.6,
    },
    rehearse: {
      title: 'Practice the event or the lift',
      description: 'Run the exact format at a controlled effort. Learn the pacing before you need it.',
      weight: 1,
    },
    final: {
      title: 'Taper and sleep',
      description: 'Reduce volume, keep movement light. The work is already done.',
      weight: 0.4,
    },
    day: {
      title: 'Show up and execute',
      description: 'Warm up properly, trust the plan, and finish proud regardless of fate.',
      weight: 0.4,
    },
  },
  personal: {
    kickoff: {
      title: 'Name the outcome and the reason',
      description: 'Write why this matters in one honest sentence. Make it visible where you work.',
      weight: 0.5,
    },
    foundation: {
      title: 'Break the promise into weekly moves',
      description: 'Small enough to do on a tired day. Put three of them in the calendar.',
      weight: 0.8,
    },
    build: {
      title: 'Do the difficult middle work',
      description: 'The middle is where most promises die. One session today is enough to keep it alive.',
      weight: 1.2,
    },
    review: {
      title: 'Check progress against the promise',
      description: 'Notice what is working. Adjust the system, not your self-worth.',
      weight: 0.7,
    },
    logistics: {
      title: 'Remove the friction',
      description: 'Find and fix the small obstacle that keeps stopping you. Preparation is kindness to future you.',
      weight: 0.6,
    },
    rehearse: {
      title: 'Dry run the final step',
      description: 'Do a smaller version now so the real moment feels familiar.',
      weight: 0.8,
    },
    final: {
      title: 'Prepare the last details',
      description: 'Lay everything out. Tell one person what you are doing so it becomes real.',
      weight: 0.6,
    },
    day: {
      title: 'Complete it and mark the moment',
      description: 'Do not rush past it. Write down how this feels — you will want to remember.',
      weight: 0.4,
    },
  },
  custom: {
    kickoff: {
      title: 'Clarify the outcome',
      description: 'Describe what will be true on the deadline day. Write it in the present tense.',
      weight: 0.6,
    },
    foundation: {
      title: 'Gather everything you need',
      description: 'People, tools, information and permissions. Ask for what you need today.',
      weight: 0.9,
    },
    build: {
      title: 'Do the core work',
      description: 'Protect one uninterrupted block for the part that actually moves the outcome.',
      weight: 1.2,
    },
    review: {
      title: 'Review with fresh eyes',
      description: 'Step away for an hour, then check it against the outcome you wrote at the start.',
      weight: 0.9,
    },
    logistics: {
      title: 'Handle the logistics',
      description: 'Confirm the details other people depend on. Send the message you are putting off.',
      weight: 0.6,
    },
    rehearse: {
      title: 'Rehearse the finish',
      description: 'Practice the final run-through in the format it will happen.',
      weight: 0.9,
    },
    final: {
      title: 'Final checks',
      description: 'One checklist, one calm pass. Stop adding scope.',
      weight: 0.6,
    },
    day: {
      title: 'Deliver on the day',
      description: 'Show up early, finish the thing, and tell someone who cares.',
      weight: 0.4,
    },
  },
};

const ROLE_BY_COUNT: Record<number, Role[]> = {
  1: ['day'],
  2: ['foundation', 'day'],
  3: ['kickoff', 'build', 'day'],
  4: ['kickoff', 'foundation', 'build', 'day'],
  5: ['kickoff', 'foundation', 'build', 'final', 'day'],
  6: ['kickoff', 'foundation', 'build', 'review', 'final', 'day'],
  7: ['kickoff', 'foundation', 'build', 'review', 'logistics', 'final', 'day'],
  8: ['kickoff', 'foundation', 'build', 'review', 'logistics', 'rehearse', 'final', 'day'],
};

const QUESTIONS: Record<CategoryId, string[]> = {
  exams: [
    'Which subjects or units feel weakest right now?',
    'How many uninterrupted hours can you protect on a weekday?',
    'Is there a mock exam, fixed syllabus or grade target to work around?',
  ],
  work: [
    'Who signs off on the final deliverable?',
    'What does “done” look like on the deadline day?',
    'Which dependency is most likely to slip?',
  ],
  project: [
    'Which single feature or flow absolutely must ship?',
    'Where does the build currently stand?',
    'Who is testing and giving the final sign-off?',
  ],
  birthday: [
    'Who is the day for, and what mood should it have?',
    'Is there a surprise, a guest of honour or a tradition to respect?',
    'What have you already booked or decided?',
  ],
  wedding: [
    'Which three vendors are already locked?',
    'What must be finished seven days before the wedding?',
    'Who owns the day-of schedule?',
  ],
  festival: [
    'Where is the gathering, and who is hosting?',
    'Which traditions or dishes are non-negotiable?',
    'Is anyone travelling in, and do they need a place to stay?',
  ],
  travel: [
    'Are flights and stays already booked?',
    'Who is travelling, and are all documents ready?',
    'What would make this trip feel effortless on arrival?',
  ],
  fitness: [
    'What is the one measurable target?',
    'How many training days a week are realistic?',
    'Any injuries, equipment limits or travel to plan around?',
  ],
  personal: [
    'What will be true when this is complete?',
    'What has stopped you before?',
    'How much time can you protect each week?',
  ],
  custom: [
    'What does success look like on the deadline day?',
    'What is the biggest risk to finishing?',
    'Is anyone else involved in the final handoff?',
  ],
};

const TIPS: Record<CategoryId, string[]> = {
  exams: [
    'Retrieval beats rereading. Close the book and write what you remember.',
    'Study in 45-minute blocks with a real break. Fatigue looks like confusion.',
    'Do the hardest subject first, when your attention is still expensive.',
  ],
  work: [
    'A rough complete draft gives reviewers something to react to. Perfection gives them nothing.',
    'Send the “here is where I am” note before someone has to ask.',
    'Protect your first 90 minutes for the work only you can do.',
  ],
  project: [
    'Cut scope, not quality. One complete flow is a product; five partial ones are a demo.',
    'Write the release note before you build. It reveals what actually matters.',
    'Test the path a stranger would take, not the one you know by heart.',
  ],
  birthday: [
    'The details people remember are attention, not expense.',
    'Write the card first. It is the part they will keep.',
    'Delegate one task completely so you can be present.',
  ],
  wedding: [
    'Decide what you will not care about on the day, and let it go now.',
    'One trusted person should hold the timeline so you do not have to.',
    'Eat breakfast. Every married couple says the same thing.',
  ],
  festival: [
    'Make-ahead dishes are the difference between hosting and surviving.',
    'Make a list, then delegate half of it with clear names attached.',
    'Set the table the night before and give yourself a slow morning.',
  ],
  travel: [
    'The first hour after arrival is where plans fail. Know your transfer.',
    'Screenshot every booking — signal is not guaranteed.',
    'Pack half the clothes and twice the patience.',
  ],
  fitness: [
    'Consistency at 70% beats a perfect week followed by three missed ones.',
    'Sleep is training. Treat it with the same respect as a session.',
    'Track the effort, not just the number. Progress hides in repetitions.',
  ],
  personal: [
    'Make the next step embarrassingly small. Momentum is a design choice.',
    'Tell one person what you are doing. Witness makes promises stick.',
    'A missed day is data, not a verdict. Restart the same day.',
  ],
  custom: [
    'If it is not on the calendar, it is a wish, not a plan.',
    'Do the part you are avoiding first, badly, for ten minutes.',
    'Leave a buffer before the deadline. Everything takes longer than the plan.',
  ],
};

const prepLabel = (minutes: number): string => {
  if (minutes <= 45) return 'a light daily rhythm';
  if (minutes <= 90) return 'about an hour a day';
  if (minutes <= 150) return 'focused two-hour sessions';
  return 'an intense preparation schedule';
};

const priorityFor = (role: Role, offset: number, goal: Goal): Priority => {
  if (role === 'day' || offset === 0) return 'critical';
  if (offset <= 3 && (role === 'final' || role === 'rehearse')) return 'critical';
  if (offset <= 5) return 'high';
  if (role === 'kickoff') return goal.importance === 'professional' ? 'high' : 'medium';
  if (role === 'foundation') return 'medium';
  if (role === 'logistics') return goal.importance === 'professional' ? 'high' : 'medium';
  return 'medium';
};

const reminderLeadFor = (role: Role): number => {
  if (role === 'day') return 120;
  if (role === 'final') return 1440;
  if (role === 'rehearse') return 1440;
  return 1440;
};

const scaledDuration = (base: number, weight: number, role: Role): number => {
  if (role === 'day') return Math.max(30, Math.round(base * 0.4 / 5) * 5);
  const raw = base * weight;
  return Math.max(20, Math.round(raw / 5) * 5);
};

const roleTask = (category: CategoryId, role: Role): RoleTask => LIBRARY[category][role];

export const getPlanningQuestions = (goal: Goal): string[] => {
  const base = QUESTIONS[goal.category];
  if (goal.notes.trim().length > 40) return base.slice(0, 2);
  return base.slice(0, 3);
};

export interface AnchorPlan {
  offset: number;
  role: Role;
  title?: string;
  description?: string;
  weight?: number;
  priority?: Priority;
}

export const buildAnchors = (goal: Goal, now = new Date()): AnchorPlan[] => {
  const deadline = parse(goal.deadline);
  const days = Math.max(0, differenceInCalendarDays(startOfDay(deadline), startOfDay(now)));
  const anchors: AnchorPlan[] = [];

  if (days > 35) {
    anchors.push({
      offset: days,
      role: 'kickoff',
      title: 'Open the runway',
      description:
        'Block your first session today and write the one outcome that matters. Starting early is the advantage.',
      weight: 0.6,
      priority: 'medium',
    });
  }

  if (days > 70) {
    const mid = Math.round(days / 2);
    anchors.push({
      offset: mid,
      role: 'review',
      title: 'Mid-point check-in',
      description:
        'Re-read the original outcome. Cut what is not serving it, and rebalance the second half of the plan.',
      weight: 0.8,
      priority: 'medium',
    });
  }

  const anchorsList = [30, 14, 10, 7, 5, 3, 1, 0].filter((offset) => offset <= days);
  if (days > 0 && days < 30 && !anchorsList.includes(days)) anchorsList.unshift(days);
  if (days === 0 && anchorsList.length === 0) anchorsList.push(0);

  const roles = ROLE_BY_COUNT[Math.min(8, Math.max(1, anchorsList.length))];
  anchorsList.forEach((offset, index) => {
    anchors.push({ offset, role: roles[Math.min(index, roles.length - 1)] });
  });

  return anchors;
};

export const buildLocalPlan = (goal: Goal, answers: string[] = [], now = new Date()): PlanDraft => {
  const deadline = parse(goal.deadline);
  const days = Math.max(0, differenceInCalendarDays(startOfDay(deadline), startOfDay(now)));
  const anchors = buildAnchors(goal, now);
  const category = categoryLabel(goal.category);
  const answerNote = answers.filter((a) => a.trim().length > 0).length > 0;

  const milestones: GeneratedMilestone[] = anchors.map((anchor) => {
    const task = roleTask(goal.category, anchor.role);
    const date =
      anchor.offset === days && days > 35
        ? addMinutes(now, 90)
        : subDays(deadline, anchor.offset);

    return {
      offsetDays: Math.max(0, differenceInCalendarDays(startOfDay(deadline), startOfDay(date))),
      title: anchor.title ?? task.title,
      description: anchor.description ?? task.description,
      priority: anchor.priority ?? priorityFor(anchor.role, anchor.offset, goal),
      duration: scaledDuration(goal.prepMinutes, anchor.weight ?? task.weight, anchor.role),
      reminderEnabled: true,
      reminderLead: reminderLeadFor(anchor.role),
    };
  });

  const completeBy = fmtDateShort(deadline);
  const summary = `${milestones.length} milestones from today to ${completeBy}, built as a ${category.toLowerCase()} runway around ${prepLabel(goal.prepMinutes)}.`;
  const rationale =
    days <= 7
      ? 'The deadline is close, so this plan keeps only the moves that materially change the outcome. The final 24 hours stay light on purpose.'
      : days > 70
        ? 'Long deadlines lose energy. This plan opens early, checks in at the midpoint, then concentrates the real work into the final month.'
        : 'The final week is protected for review, logistics and rest. Earlier milestones build the foundation so the last days feel calm rather than frantic.';

  return {
    summary,
    rationale: answerNote
      ? `${rationale} Your answers were folded into the emphasis of each step.`
      : rationale,
    questions: getPlanningQuestions(goal),
    milestones,
    generatedBy: 'local',
  };
};

export const draftToMilestones = (goal: Goal, draft: PlanDraft): Milestone[] => {
  const deadline = parse(goal.deadline);
  return draft.milestones
    .slice()
    .sort((a, b) => b.offsetDays - a.offsetDays)
    .map((m, index) => {
      const date = subDays(deadline, m.offsetDays);
      return {
        id: uid('ms'),
        goalId: goal.id,
        title: m.title,
        description: m.description,
        date: date.toISOString(),
        offsetDays: m.offsetDays,
        priority: m.priority,
        duration: m.duration,
        done: false,
        reminderEnabled: m.reminderEnabled,
        reminderLead: m.reminderLead,
        order: index,
        generatedBy: draft.generatedBy,
      };
    });
};

export const categoryLabel = (category: CategoryId): string =>
  CATEGORIES.find((c) => c.id === category)?.label ?? 'Custom goals';

export const sortedMilestones = (milestones: Milestone[]): Milestone[] =>
  milestones
    .slice()
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime() || a.order - b.order);

export const nextMilestone = (milestones: Milestone[], now = new Date()): Milestone | null => {
  const pending = milestones.filter((m) => !m.done);
  const upcoming = pending
    .filter((m) => new Date(m.date).getTime() >= now.getTime())
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  if (upcoming.length > 0) return upcoming[0];
  return (
    pending.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())[0] ?? null
  );
};

export const urgencyScore = (milestone: Milestone, goal: Goal, now = new Date()): number => {
  const days = daysUntil(milestone.date, now);
  const priorityRank = PRIORITY_META[milestone.priority].rank;
  const base = milestone.done ? 0 : 60 - priorityRank * 12;
  const proximity = isOverdue(milestone.date, now) ? 55 : Math.max(0, 30 - days * 3);
  const importanceBoost = goal.importance === 'professional' ? 6 : 2;
  return Math.min(100, Math.max(0, Math.round(base + proximity + importanceBoost)));
};

export const buildLocalCoach = (
  goal: Goal,
  milestones: Milestone[],
  now = new Date(),
): CoachPlan => {
  const pending = sortedMilestones(milestones.filter((m) => !m.done));
  const overdue = pending.filter((m) => isOverdue(m.date, now));
  const days = daysUntil(goal.deadline, now);
  const total = milestones.length;
  const done = milestones.filter((m) => m.done).length;
  const priorities = pending
    .slice()
    .sort((a, b) => urgencyScore(b, goal, now) - urgencyScore(a, goal, now))
    .slice(0, 3)
    .map((m) => ({
      milestoneId: m.id,
      label: m.title,
      why: `${isOverdue(m.date, now) ? 'Overdue' : `Due ${fmtDateShort(m.date)}`} · ${fmtDuration(
        m.duration,
      )} · ${PRIORITY_META[m.priority].label.toLowerCase()} priority`,
    }));

  const headline =
    days < 0
      ? 'The deadline has passed. Close the loop with intention.'
      : days === 0
        ? 'Today is the day. Only the essential moves remain.'
        : done === total && total > 0
          ? 'Everything is complete. Protect the moment.'
          : `${days} day${days === 1 ? '' : 's'} left. ${pending.length} move${
              pending.length === 1 ? '' : 's'
            } that matter.`;

  const body =
    pending.length === 0
      ? 'Your plan is complete. Take five minutes to note what worked — it will make the next deadline easier.'
      : overdue.length > 0
        ? `${overdue.length} milestone${overdue.length === 1 ? ' is' : 's are'} overdue. Do not try to recover everything at once; pick the smallest overdue task, finish it, then reschedule the rest with a clear head.`
        : `${done} of ${total} milestones complete. Start with “${priorities[0]?.label ?? 'the next task'}” and give it one uninterrupted block. Momentum is worth more than a perfect plan.`;

  const tips = TIPS[goal.category];
  const tip = tips[now.getDate() % tips.length];

  return {
    headline,
    body,
    tip,
    priorities,
    generatedBy: 'local',
  };
};

const MISSING_IDEAS: Record<CategoryId, { title: string; description: string; offset: number; duration: number }[]> = {
  exams: [
    { title: 'Create a one-page formula or summary sheet', description: 'The act of condensing is the revision. Keep it to a single page you can scan.', offset: 4, duration: 60 },
    { title: 'Book a quiet study space', description: 'Remove the negotiation with your environment before the high-stakes days.', offset: 8, duration: 15 },
    { title: 'Ask for one clarification from your tutor', description: 'Write the three questions you keep circling, and ask them in one message.', offset: 6, duration: 20 },
  ],
  work: [
    { title: 'Draft the covering note or executive summary', description: 'Writing the summary early exposes fuzzy thinking and missing evidence.', offset: 3, duration: 40 },
    { title: 'Schedule a pre-read for reviewers', description: 'Give people time to react before the deadline, not on it.', offset: 5, duration: 15 },
    { title: 'Prepare a fallback for the riskiest dependency', description: 'Decide now what happens if a key input arrives late.', offset: 6, duration: 30 },
  ],
  project: [
    { title: 'Write the release notes and known limitations', description: 'It forces clarity about what is actually ready.', offset: 4, duration: 45 },
    { title: 'Add observability before launch', description: 'Logs and one health signal save hours of blind debugging.', offset: 6, duration: 60 },
    { title: 'Prepare a rollback rehearsal', description: 'Confirm who can revert, and how, while nothing is on fire.', offset: 3, duration: 30 },
  ],
  birthday: [
    { title: 'Write a meaningful note or card', description: 'The words are usually the gift people keep.', offset: 3, duration: 20 },
    { title: 'Confirm a photographer or one person to take photos', description: 'You will want the moment captured without spending it behind a phone.', offset: 4, duration: 10 },
    { title: 'Plan the arrival and departure logistics', description: 'Who needs a lift, and who is staying over?', offset: 5, duration: 20 },
  ],
  wedding: [
    { title: 'Prepare a wet-weather or plan-B option', description: 'Have the alternative decided and communicated before the week of.', offset: 14, duration: 30 },
    { title: 'Write vendor arrival times on a single sheet', description: 'One page, shared with two trusted people.', offset: 7, duration: 30 },
    { title: 'Plan the morning-of schedule', description: 'Hair, make-up, breakfast and quiet time. Add a buffer.', offset: 3, duration: 30 },
  ],
  festival: [
    { title: 'Check serving dishes, chairs and power', description: 'The invisible logistics break the evening if left to the last hour.', offset: 5, duration: 20 },
    { title: 'Plan for one guest with a dietary need', description: 'A clearly labelled option is a small act of care.', offset: 6, duration: 20 },
    { title: 'Make a clean-up plan', description: 'Decide who stays and how rubbish leaves the house.', offset: 2, duration: 15 },
  ],
  travel: [
    { title: 'Check passport and visa validity', description: 'Many countries require six months beyond arrival.', offset: 21, duration: 20 },
    { title: 'Arrange travel insurance and emergency contacts', description: 'Save the policy number offline and share it with someone at home.', offset: 14, duration: 20 },
    { title: 'Download offline maps and translation', description: 'The first ten minutes in a new city are the most fragile.', offset: 2, duration: 15 },
  ],
  fitness: [
    { title: 'Plan rest days and a deload week', description: 'Recovery is where adaptation happens.', offset: 10, duration: 20 },
    { title: 'Take before photos and measurements', description: 'You will want an honest baseline, not a memory of one.', offset: 20, duration: 15 },
    { title: 'Prepare one high-protein meal for busy days', description: 'Decide the default meal before hunger decides for you.', offset: 7, duration: 45 },
  ],
  personal: [
    { title: 'Tell one person about the commitment', description: 'A witness turns a private intention into a real promise.', offset: 7, duration: 10 },
    { title: 'Design the smallest version of the habit', description: 'Two minutes counts. Make the floor impossibly low.', offset: 10, duration: 20 },
    { title: 'Write a letter to yourself about why this matters', description: 'You will read it on the day motivation is quiet.', offset: 5, duration: 15 },
  ],
  custom: [
    { title: 'Line up a second pair of eyes', description: 'Someone who will review the work before the deadline, with a date booked.', offset: 5, duration: 20 },
    { title: 'Define the final handoff', description: 'Where does it go, who receives it, and what confirms delivery?', offset: 4, duration: 20 },
    { title: 'Create a one-page final checklist', description: 'Everything that must be true on the deadline day, in the order it matters.', offset: 7, duration: 25 },
  ],
};

export const suggestMissingMilestones = (
  goal: Goal,
  milestones: Milestone[],
): { title: string; description: string; offset: number; duration: number }[] => {
  const existing = milestones.map((m) => m.title.toLowerCase());
  return MISSING_IDEAS[goal.category]
    .filter((idea) => !existing.some((title) => title.includes(idea.title.toLowerCase().slice(0, 18))))
    .slice(0, 3)
    .map((idea) => ({
      ...idea,
      offset: Math.min(idea.offset, Math.max(0, daysUntil(goal.deadline))),
    }));
};

export interface RescheduleResult {
  milestones: Milestone[];
  moved: number;
  summary: string;
}

export const rescheduleMilestones = (
  goal: Goal,
  milestones: Milestone[],
  now = new Date(),
): RescheduleResult => {
  const deadline = parse(goal.deadline);
  const completed = milestones.filter((m) => m.done);
  const pending = sortedMilestones(milestones.filter((m) => !m.done));
  const finalMilestone = pending.find(
    (m) => m.offsetDays === 0 || new Date(m.date).getTime() === deadline.getTime(),
  );
  const movable = pending.filter((m) => m !== finalMilestone);

  const availableDays = Math.max(0, differenceInCalendarDays(startOfDay(deadline), startOfDay(now)));
  let moved = 0;

  const rescheduledMove = movable.map((m, index) => {
    const original = new Date(m.date);
    let target: Date;
    if (availableDays <= 0) {
      target = addMinutes(now, 30 + index * 30);
    } else {
      const fraction = (index + 1) / (movable.length + 1);
      const dayOffset = Math.min(availableDays, Math.max(0, Math.round(fraction * availableDays)));
      const base = addDays(startOfDay(now), dayOffset);
      target = setMinutes(setHours(base, original.getHours()), original.getMinutes());
      if (target.getTime() < now.getTime()) target = addMinutes(now, 45 + index * 20);
    }
    const wasOverdue = isOverdue(m.date, now);
    if (Math.abs(target.getTime() - original.getTime()) > 60 * 60 * 1000) moved += 1;
    return {
      ...m,
      date: target.toISOString(),
      offsetDays: Math.max(0, differenceInCalendarDays(startOfDay(deadline), startOfDay(target))),
      priority: wasOverdue && m.priority === 'low' ? ('high' as Priority) : m.priority,
    };
  });

  const final = finalMilestone ? { ...finalMilestone } : undefined;
  const merged = [...completed, ...rescheduledMove, ...(final ? [final] : [])].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
  );

  return {
    milestones: merged.map((m, index) => ({ ...m, order: index })),
    moved,
    summary:
      moved === 0
        ? 'Your remaining work already fits the time you have. No changes were needed.'
        : `Rebalanced ${moved} milestone${moved === 1 ? '' : 's'} across the remaining ${availableDays} day${
            availableDays === 1 ? '' : 's'
          }. The deadline itself has not moved.`,
  };
};

export const checkMilestoneQuality = (draft: PlanDraft): string[] => {
  const warnings: string[] = [];
  if (draft.milestones.length === 0) warnings.push('The plan came back empty — try again or build it manually.');
  if (draft.milestones.some((m) => !m.title.trim())) warnings.push('One or more steps are missing a title.');
  return warnings;
};

export const reorderMilestones = (milestones: Milestone[], from: number, to: number): Milestone[] => {
  const sorted = sortedMilestones(milestones);
  if (from < 0 || to < 0 || from >= sorted.length || to >= sorted.length) return milestones;
  const copy = sorted.slice();
  const [item] = copy.splice(from, 1);
  copy.splice(to, 0, item);
  return copy.map((m, index) => ({ ...m, order: index }));
};

export const offsetForDate = (deadline: string, date: string): number => {
  const difference = differenceInCalendarDays(
    startOfDay(parseISO(deadline)),
    startOfDay(parseISO(date)),
  );
  return Math.max(0, difference);
};
