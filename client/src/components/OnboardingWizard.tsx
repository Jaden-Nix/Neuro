import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Brain, 
  Zap, 
  Shield, 
  Cpu, 
  Wallet, 
  ArrowRight, 
  ArrowLeft,
  CheckCircle,
  Play,
  X,
  Sparkles,
  Target,
  TrendingUp,
  AlertTriangle,
  Layers
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';

interface OnboardingWizardProps {
  onComplete: () => void;
  onSkip: () => void;
}

const ONBOARDING_STEPS = [
  {
    id: 'welcome',
    title: 'Welcome to NeuroNet Governor',
    description: 'An autonomous multi-agent AI system for DeFi protocol governance',
    icon: Brain,
    color: 'hsl(var(--meta))',
    content: {
      headline: 'Intelligent DeFi Governance',
      features: [
        { icon: Sparkles, text: 'AI-powered decision making with Claude' },
        { icon: Target, text: 'Multi-agent negotiation protocol' },
        { icon: TrendingUp, text: 'Monte Carlo future predictions' },
        { icon: Shield, text: 'MEV protection via Flashbots' },
      ],
    },
  },
  {
    id: 'agents',
    title: 'Meet Your AI Agents',
    description: 'Four specialized agents work together to manage DeFi governance',
    icon: Layers,
    color: 'hsl(var(--primary))',
    content: {
      agents: [
        { 
          name: 'Scout Agent', 
          role: 'Opportunity Detection',
          color: 'hsl(var(--scout))',
          traits: ['Curious', 'Energetic'],
          tasks: 'Scans markets, identifies arbitrage, predicts volatility'
        },
        { 
          name: 'Risk Agent', 
          role: 'Safety Evaluation',
          color: 'hsl(var(--risk))',
          traits: ['Cautious', 'Formal'],
          tasks: 'Evaluates proposals, blocks high-risk decisions, performs vetoes'
        },
        { 
          name: 'Execution Agent', 
          role: 'Transaction Execution',
          color: 'hsl(var(--execution))',
          traits: ['Precise', 'Cold'],
          tasks: 'Creates safe transactions, optimizes gas, executes on-chain'
        },
        { 
          name: 'Meta-Agent', 
          role: 'Central Orchestrator',
          color: 'hsl(var(--meta))',
          traits: ['Sovereign', 'Calm'],
          tasks: 'Coordinates agents, makes final decisions, manages credits'
        },
      ],
    },
  },
  {
    id: 'features',
    title: 'Key Features',
    description: 'Powerful tools for autonomous DeFi management',
    icon: Zap,
    color: 'hsl(var(--scout))',
    content: {
      features: [
        {
          title: 'Credit Economy',
          description: 'Agents earn/lose credits based on performance',
          icon: Target,
        },
        {
          title: 'Memory Vault',
          description: 'On-chain storage of strategies and patterns',
          icon: Brain,
        },
        {
          title: 'Sentinel Monitor',
          description: '24/7 monitoring of wallet health and anomalies',
          icon: Shield,
        },
        {
          title: 'Replay Engine',
          description: 'Complete decision timeline with visualization',
          icon: Play,
        },
        {
          title: 'ML Pattern Recognition',
          description: 'K-means clustering for market analysis',
          icon: Sparkles,
        },
        {
          title: 'Multi-Chain Support',
          description: 'Ethereum, Base, Fraxtal, and Solana',
          icon: Layers,
        },
      ],
    },
  },
  {
    id: 'atp',
    title: 'ATP Integration',
    description: 'Built with ADK-TS for Agent Tokenization Platform compatibility',
    icon: Cpu,
    color: 'hsl(var(--execution))',
    content: {
      integrations: [
        {
          name: 'ADK-TS Framework',
          description: 'IQ AI Agent Development Kit for TypeScript',
          status: 'active',
        },
        {
          name: 'ATP Launch Ready',
          description: 'Agents can be tokenized and traded on ATP',
          status: 'ready',
        },
        {
          name: 'IQ Token Integration',
          description: 'Staking, airdrops, and governance support',
          status: 'active',
        },
        {
          name: 'Smart Contracts',
          description: 'MemoryVault and AgentRegistry on Fraxtal',
          status: 'ready',
        },
      ],
    },
  },
  {
    id: 'connect',
    title: 'Connect Your Wallet',
    description: 'Start interacting with NeuroNet Governor',
    icon: Wallet,
    color: 'hsl(var(--risk))',
    content: {
      steps: [
        'Connect your wallet using the button in the header',
        'Choose your preferred network (Ethereum, Base, or Fraxtal)',
        'Explore the Command Center dashboard',
        'Run simulations and test the AI agents',
      ],
    },
  },
];

export function OnboardingWizard({ onComplete, onSkip }: OnboardingWizardProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [isVisible, setIsVisible] = useState(true);

  const step = ONBOARDING_STEPS[currentStep];
  const progress = ((currentStep + 1) / ONBOARDING_STEPS.length) * 100;
  const isLastStep = currentStep === ONBOARDING_STEPS.length - 1;

  const handleNext = () => {
    if (isLastStep) {
      handleComplete();
    } else {
      setCurrentStep(prev => prev + 1);
    }
  };

  const handlePrev = () => {
    if (currentStep > 0) {
      setCurrentStep(prev => prev - 1);
    }
  };

  const handleComplete = () => {
    localStorage.setItem('neuronet_onboarding_complete', 'true');
    setIsVisible(false);
    setTimeout(onComplete, 300);
  };

  const handleSkip = () => {
    localStorage.setItem('neuronet_onboarding_complete', 'true');
    setIsVisible(false);
    setTimeout(onSkip, 300);
  };

  const Icon = step.icon;

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm"
          data-testid="onboarding-overlay"
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            transition={{ type: 'spring', damping: 20 }}
            className="w-full max-w-2xl mx-4"
          >
            <Card className="relative overflow-hidden">
              <Button
                variant="ghost"
                size="icon"
                className="absolute top-4 right-4 z-10"
                onClick={handleSkip}
                data-testid="button-skip-onboarding"
              >
                <X className="h-4 w-4" />
              </Button>

              <div className="absolute top-0 left-0 right-0 h-1 bg-muted">
                <motion.div
                  className="h-full bg-primary"
                  initial={{ width: 0 }}
                  animate={{ width: `${progress}%` }}
                  transition={{ duration: 0.3 }}
                />
              </div>

              <CardHeader className="pt-8 text-center">
                <motion.div
                  key={step.id}
                  initial={{ scale: 0, rotate: -180 }}
                  animate={{ scale: 1, rotate: 0 }}
                  transition={{ type: 'spring', damping: 15 }}
                  className="mx-auto mb-4 p-4 rounded-full"
                  style={{ backgroundColor: `${step.color}20` }}
                >
                  <Icon className="h-8 w-8" style={{ color: step.color }} />
                </motion.div>
                
                <CardTitle className="text-2xl" data-testid="text-onboarding-title">
                  {step.title}
                </CardTitle>
                <CardDescription className="text-base">
                  {step.description}
                </CardDescription>
              </CardHeader>

              <CardContent className="pb-8">
                <AnimatePresence mode="wait">
                  <motion.div
                    key={step.id}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ duration: 0.2 }}
                    className="min-h-[280px]"
                  >
                    {step.id === 'welcome' && (
                      <div className="space-y-4">
                        <p className="text-lg font-medium text-center mb-6">
                          {step.content.headline}
                        </p>
                        <div className="grid grid-cols-2 gap-3">
                          {step.content.features.map((feature, i) => (
                            <motion.div
                              key={i}
                              initial={{ opacity: 0, y: 20 }}
                              animate={{ opacity: 1, y: 0 }}
                              transition={{ delay: i * 0.1 }}
                              className="flex items-center gap-2 p-3 rounded-lg bg-muted/50"
                            >
                              <feature.icon className="h-5 w-5 text-primary" />
                              <span className="text-sm">{feature.text}</span>
                            </motion.div>
                          ))}
                        </div>
                      </div>
                    )}

                    {step.id === 'agents' && (
                      <div className="grid grid-cols-2 gap-3">
                        {step.content.agents.map((agent, i) => (
                          <motion.div
                            key={agent.name}
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ delay: i * 0.1 }}
                            className="p-3 rounded-lg border"
                          >
                            <div className="flex items-center gap-2 mb-2">
                              <div 
                                className="h-3 w-3 rounded-full"
                                style={{ backgroundColor: agent.color }}
                              />
                              <span className="font-medium text-sm">{agent.name}</span>
                            </div>
                            <p className="text-xs text-muted-foreground mb-2">{agent.role}</p>
                            <div className="flex flex-wrap gap-1 mb-2">
                              {agent.traits.map(trait => (
                                <Badge key={trait} variant="secondary" className="text-xs">
                                  {trait}
                                </Badge>
                              ))}
                            </div>
                            <p className="text-xs text-muted-foreground">{agent.tasks}</p>
                          </motion.div>
                        ))}
                      </div>
                    )}

                    {step.id === 'features' && (
                      <div className="grid grid-cols-2 gap-3">
                        {step.content.features.map((feature, i) => (
                          <motion.div
                            key={feature.title}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: i * 0.08 }}
                            className="flex items-start gap-3 p-3 rounded-lg bg-muted/50"
                          >
                            <feature.icon className="h-5 w-5 text-primary mt-0.5" />
                            <div>
                              <p className="font-medium text-sm">{feature.title}</p>
                              <p className="text-xs text-muted-foreground">{feature.description}</p>
                            </div>
                          </motion.div>
                        ))}
                      </div>
                    )}

                    {step.id === 'atp' && (
                      <div className="space-y-3">
                        {step.content.integrations.map((integration, i) => (
                          <motion.div
                            key={integration.name}
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: i * 0.1 }}
                            className="flex items-center justify-between p-3 rounded-lg border"
                          >
                            <div>
                              <p className="font-medium text-sm">{integration.name}</p>
                              <p className="text-xs text-muted-foreground">{integration.description}</p>
                            </div>
                            <Badge variant={integration.status === 'active' ? 'default' : 'secondary'}>
                              {integration.status === 'active' ? (
                                <><CheckCircle className="h-3 w-3 mr-1" /> Active</>
                              ) : (
                                <><Zap className="h-3 w-3 mr-1" /> Ready</>
                              )}
                            </Badge>
                          </motion.div>
                        ))}
                      </div>
                    )}

                    {step.id === 'connect' && (
                      <div className="space-y-4">
                        {step.content.steps.map((stepText, i) => (
                          <motion.div
                            key={i}
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: i * 0.1 }}
                            className="flex items-center gap-3"
                          >
                            <div className="flex-shrink-0 h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-medium">
                              {i + 1}
                            </div>
                            <p className="text-sm">{stepText}</p>
                          </motion.div>
                        ))}
                        
                        <motion.div
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: 0.5 }}
                          className="mt-6 p-4 rounded-lg bg-primary/5 border border-primary/20 text-center"
                        >
                          <Sparkles className="h-6 w-6 text-primary mx-auto mb-2" />
                          <p className="text-sm font-medium">Ready to explore!</p>
                          <p className="text-xs text-muted-foreground">
                            Click "Get Started" to enter the Command Center
                          </p>
                        </motion.div>
                      </div>
                    )}
                  </motion.div>
                </AnimatePresence>

                <div className="flex items-center justify-between mt-6 pt-4 border-t">
                  <div className="flex items-center gap-2">
                    {ONBOARDING_STEPS.map((_, i) => (
                      <button
                        key={i}
                        onClick={() => setCurrentStep(i)}
                        className={`h-2 rounded-full transition-all ${
                          i === currentStep ? 'w-6 bg-primary' : 'w-2 bg-muted hover:bg-muted-foreground/50'
                        }`}
                        data-testid={`button-step-${i}`}
                      />
                    ))}
                  </div>

                  <div className="flex items-center gap-2">
                    {currentStep > 0 && (
                      <Button 
                        variant="outline" 
                        onClick={handlePrev}
                        data-testid="button-prev-step"
                      >
                        <ArrowLeft className="h-4 w-4 mr-1" />
                        Back
                      </Button>
                    )}
                    <Button 
                      onClick={handleNext}
                      data-testid="button-next-step"
                    >
                      {isLastStep ? (
                        <>
                          Get Started
                          <Play className="h-4 w-4 ml-1" />
                        </>
                      ) : (
                        <>
                          Next
                          <ArrowRight className="h-4 w-4 ml-1" />
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export function useOnboarding() {
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [hasChecked, setHasChecked] = useState(false);

  useEffect(() => {
    const completed = localStorage.getItem('neuronet_onboarding_complete');
    setShowOnboarding(!completed);
    setHasChecked(true);
  }, []);

  const resetOnboarding = () => {
    localStorage.removeItem('neuronet_onboarding_complete');
    setShowOnboarding(true);
  };

  return {
    showOnboarding,
    hasChecked,
    completeOnboarding: () => setShowOnboarding(false),
    resetOnboarding,
  };
}
