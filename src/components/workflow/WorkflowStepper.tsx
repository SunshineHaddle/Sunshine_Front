import { Icon } from '../common/Icon'

type WorkflowStepperProps = {
  activeStep: 1 | 2 | 3
  labels: [string, string, string]
}

export function WorkflowStepper({ activeStep, labels }: WorkflowStepperProps) {
  return (
    <ol className="workflow-stepper" aria-label="데이터 입력 진행 단계">
      {labels.map((label, index) => {
        const step = (index + 1) as 1 | 2 | 3
        const isComplete = step < activeStep
        const isActive = step === activeStep

        return (
          <li className={`${isComplete ? 'is-complete' : ''}${isActive ? ' is-active' : ''}`} key={label}>
            <span className="workflow-stepper__line" aria-hidden="true" />
            <span className="workflow-stepper__marker">
              {isComplete ? <Icon name="check" size={14} /> : step}
            </span>
            <span className="workflow-stepper__label">{label}</span>
          </li>
        )
      })}
    </ol>
  )
}
