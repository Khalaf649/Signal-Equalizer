export default appState = {
  inputSignal: [], // array of f(t)
  outputSignal: [], // array of f_out(t)
  time: [], // array of t
  inputFftMagnitudes: [], // array of |F(w)|
  outputFftMagnitudes: [], // array of |F_out(w)|
  fftFrequencies: [], // array of w
  mode: "generic", // current mode
  bands: [], // current sliders for mode
  originalJson: null,
  renderedJson: null,
};
