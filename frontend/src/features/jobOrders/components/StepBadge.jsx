import Badge from '../../../components/common/Badge';

// Fixed steps (backend constants/stepConstants.js FIXED_STEPS) by colour; the
// vendor's own steps are purple.
const VARIANTS = { start: 'blue', inProgress: 'blue', hold: 'yellow', completed: 'green' };

/**
 * Someone's current step on a piece of work: "In progress · 40%", "Hold",
 * or "Not started" when they haven't moved it yet.
 *
 * @param {Object} props
 * @param {{ name: string, fixedStep: string|null, percent: number|null }|null} props.step
 */
const StepBadge = ({ step }) => {
  if (!step) return <Badge variant="gray" size="sm">Not started</Badge>;
  return (
    <Badge variant={VARIANTS[step.fixedStep] || 'purple'} size="sm">
      {step.name}{step.percent !== null && step.percent !== undefined ? ` · ${step.percent}%` : ''}
    </Badge>
  );
};

export default StepBadge;
