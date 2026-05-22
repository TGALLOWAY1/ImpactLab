# Constraints

## Technical constraints
- Prototype uses browser Web Audio and AudioWorklet; behavior depends on browser support.
- SharedArrayBuffer visual path requires cross-origin isolation headers.
- Worklet file in `public/` cannot import from app source modules.
- Fixed plugin surface dimensions constrain responsiveness.

## Process constraints
- No automated tests currently; manual verification burden is high.
- No linter/type-check gate; consistency relies on discipline.
- Documentation historically fragmented across multiple root/docs files.

## Product constraints
- Must not claim production-grade DSP validation without objective audio QA.
- UI affordances that are display-only must be explicitly labeled in docs.
