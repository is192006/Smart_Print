import { Icon } from './Icon'

interface StepperProps {
  steps: string[]
  currentIndex: number
}

export function Stepper({ steps, currentIndex }: StepperProps) {
  return (
    <div className="steps" role="list" aria-label="Progress">
      {steps.map((step, i) => (
        <div className="step" key={step} role="listitem">
          <div
            className={`step ${i < currentIndex ? 'step--done' : i === currentIndex ? 'step--active' : ''}`}
            style={{ gap: 8 }}
          >
            <span className="step__circle" aria-current={i === currentIndex ? 'step' : undefined}>
              {i < currentIndex ? <Icon name="check" size={14} /> : i + 1}
            </span>
            <span className="step__label">{step}</span>
          </div>
          {i < steps.length - 1 && (
            <span className={`step__line ${i < currentIndex ? 'step__line--done' : ''}`} />
          )}
        </div>
      ))}
    </div>
  )
}
