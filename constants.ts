import { Scenario, LayerType, BlueprintColumn } from './types';

export const SCENARIOS: Scenario[] = [
  {
    id: 'coffee-shop',
    title: 'The Morning Rush',
    description: 'Map the journey of a student ordering a latte at a busy campus coffee shop.',
    difficulty: 'Beginner',
    initialPhases: ['Arrival', 'Ordering', 'Payment', 'Waiting', 'Pickup', 'Consumption'],
    context: 'A busy specialty coffee shop on a university campus during morning peak hours (8:00 AM).'
  },
  {
    id: 'airline-checkin',
    title: 'Flight Check-In',
    description: 'Analyze the process of checking in bags and getting a boarding pass at an airport kiosk.',
    difficulty: 'Intermediate',
    initialPhases: ['Entering Terminal', 'Kiosk Interaction', 'Bag Tagging', 'Bag Drop', 'Security Check'],
    context: 'An international airport departure hall using self-service kiosks and automated bag drops.'
  },
  {
    id: 'er-visit',
    title: 'Emergency Room Visit',
    description: 'A complex service involving triage, waiting, examination, and discharge in a hospital.',
    difficulty: 'Advanced',
    initialPhases: ['Arrival', 'Triage', 'Registration', 'Waiting Room', 'Examination', 'Treatment', 'Discharge'],
    context: 'A city hospital emergency room on a Friday night. High stress, variable wait times.'
  }
];

export const TUTORIAL_SCENARIO: Scenario = {
  id: 'tutorial-toast',
  title: 'Service Design Bootcamp',
  description: 'Learn the basics by mapping a simple request: Ordering a piece of toast.',
  difficulty: 'Beginner',
  initialPhases: ['Ordering Toast'],
  context: 'A simple breakfast diner interaction.'
};

export const TUTORIAL_STEPS = [
  {
    targetLayer: 'intro',
    title: 'Welcome to Bootcamp',
    content: "Service Blueprints visualize how a service works. We're going to map a single step: 'Ordering Toast'. Click Next to start."
  },
  {
    targetLayer: 'phase',
    title: 'The Phase',
    content: "Every column represents a distinct time period or step in the customer's journey. We are currently in the 'Ordering Toast' phase."
  },
  {
    targetLayer: 'physical',
    title: 'Physical Evidence',
    content: "What does the customer SEE or TOUCH? For toast, this might be the 'Menu' or the 'Counter'. Type 'Menu' in the highlighted box."
  },
  {
    targetLayer: 'customer',
    title: 'Customer Actions',
    content: "What does the customer DO? This is the foundation of the map. Type 'Asks for wheat toast' here."
  },
  {
    targetLayer: 'frontstage',
    title: 'Frontstage Actions',
    content: "What does the employee do FACE-TO-FACE with the customer? This interacts directly with the Customer Action. Type 'Takes order'."
  },
  {
    targetLayer: 'backstage',
    title: 'Backstage Actions',
    content: "What happens BEHIND the scenes to make that toast? The customer doesn't see this. Type 'Puts bread in toaster'."
  },
  {
    targetLayer: 'support',
    title: 'Support Processes',
    content: "What internal systems or tools allow the employees to do their job? Type 'POS System' or 'Kitchen Display'."
  },
  {
    targetLayer: 'analysis',
    title: 'Pain Points & Opportunities',
    content: "Finally, we analyze! If the toaster is broken, that's a Pain Point. If we can offer fancy jam, that's an Opportunity."
  },
  {
    targetLayer: 'finish',
    title: 'Bootcamp Complete!',
    content: "You've built a full vertical slice of a service! You are now ready to tackle a full mission. Click 'Exit Tutorial' to return."
  }
];

export const LAYER_INFO: Record<LayerType, { label: string; color: string; description: string }> = {
  physical: {
    label: 'Physical Evidence',
    color: 'bg-gradient-to-br from-slate-50 to-slate-200 border-slate-400 text-slate-700',
    description: 'Tangible things the customer sees or touches (Menu, Kiosk, Receipt, Cup)'
  },
  customer: {
    label: 'Customer Actions',
    color: 'bg-gradient-to-br from-blue-50 to-blue-100 border-blue-400 text-blue-700',
    description: 'What the customer actually does (Queues, Orders, Pays, Sits)'
  },
  frontstage: {
    label: 'Frontstage Actions',
    color: 'bg-gradient-to-br from-emerald-50 to-emerald-100 border-emerald-400 text-emerald-700',
    description: 'Employee actions visible to the customer (Greets, Takes Order, Hands Coffee)'
  },
  backstage: {
    label: 'Backstage Actions',
    color: 'bg-gradient-to-br from-amber-50 to-amber-100 border-amber-400 text-amber-700',
    description: 'Employee actions invisible to the customer (Grinds Beans, Checks Inventory)'
  },
  support: {
    label: 'Support Processes',
    color: 'bg-gradient-to-br from-violet-50 to-violet-100 border-violet-400 text-violet-700',
    description: 'Internal systems or services that support the employees (Payment System, Supply Chain)'
  }
};

export const EXAMPLE_BLUEPRINT: BlueprintColumn[] = [
  {
    id: 'col-0',
    phase: 'Arrival',
    physical: 'Entrance Door, A-Frame Sign, Queue Ropes, Menu Board',
    customer: 'Walks through door, checks queue length, scans menu while waiting',
    frontstage: 'Greets customer entering (if eye contact made)',
    backstage: 'Restocks napkin holder near entrance',
    support: 'Background music playlist system',
    painPoints: ['Queue extends out the door', 'Menu font is too small to read from back of line'],
    opportunities: ['Move menu board closer to entrance', 'Add QR code for digital menu while waiting']
  },
  {
    id: 'col-1',
    phase: 'Ordering',
    physical: 'Counter, POS Terminal, Pastry Display case',
    customer: 'States order (Latte), asks about oat milk surcharge',
    frontstage: 'Enters order into POS, upsells seasonal pastry',
    backstage: '',
    support: 'Inventory management system updates stock levels',
    painPoints: ['Loud espresso machine makes it hard to hear barista'],
    opportunities: ['Install sound dampening behind machine']
  },
  {
    id: 'col-2',
    phase: 'Payment',
    physical: 'Card Reader, Receipt',
    customer: 'Taps phone (Apple Pay)',
    frontstage: 'Activates card reader, hands receipt (if requested)',
    backstage: '',
    support: 'Payment gateway processing (Stripe/Square)',
    painPoints: ['Card reader lag'],
    opportunities: []
  },
  {
    id: 'col-3',
    phase: 'Waiting',
    physical: 'Waiting Area, Community Board',
    customer: 'Stands to side, scrolls social media',
    frontstage: 'Writes name on cup, passes cup to barista line',
    backstage: 'Steams milk, pulls espresso shot',
    support: 'Order ticketing system (KDS - Kitchen Display System)',
    painPoints: ['Unclear where to stand', 'Awkward eye contact with people sitting nearby'],
    opportunities: ['Designate specific waiting zone with floor markings']
  },
  {
    id: 'col-4',
    phase: 'Pickup',
    physical: 'Pickup Counter, Coffee Cup, Sleeve',
    customer: 'Hears name, grabs cup, takes napkin',
    frontstage: 'Calls out name loudly, places drink on counter',
    backstage: 'Rinses pitcher',
    support: '',
    painPoints: ['Hard to hear name called over music', 'Confusion between two "Sarahs"'],
    opportunities: ['Customer facing screen for ready orders']
  },
  {
    id: 'col-5',
    phase: 'Consumption',
    physical: 'Table, Chair, Wifi Password Sign',
    customer: 'Sits down, sips coffee, connects to Wifi',
    frontstage: 'Cleans adjacent tables',
    backstage: 'Washes dishes in back sink',
    support: 'Wifi router/ISP connection',
    painPoints: ['Wifi is spotty', 'Table wobble spills coffee'],
    opportunities: ['Fix table legs', 'Upgrade to mesh network']
  }
];