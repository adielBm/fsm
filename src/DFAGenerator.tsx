import React, { useState, useEffect, useRef } from 'react';
import './App.css';
import tikzjaxJs from "./tikzjax.js?raw"; // For Vite (bundler must support ?raw)

interface Transition {
  [symbol: string]: string;
}

interface Transitions {
  [fromState: string]: Transition;
}

const DFAGenerator: React.FC = () => {
  const [states, setStates] = useState<string>('q1, q2; q3');
  const [initialState, setInitialState] = useState<string>('q1');
  const [acceptingStates, setAcceptingStates] = useState<string>('q2,q3');
  const [transitions, setTransitions] = useState<string>('q1, 0, q1; \nq1, 1, q2; \nq2, 1, 0, q2; \nq3, 0, 1, q2;');
  const [nodeDistance, setNodeDistance] = useState<number>(80);
  const [innerSep, setInnerSep] = useState<number>(4);
  const [bendAngle, setBendAngle] = useState<number>(30);
  const [shorten, setShorten] = useState<number>(3);
  const [initialText, setInitialText] = useState<string>('start');
  const [initialWhere, setInitialWhere] = useState<string>('left');
  const [acceptingBy, setAcceptingBy] = useState<string>('accepting by double');
  const [arrowType, setArrowType] = useState<string>('Stealth[round]');
  const [nodeColor, setNodeColor] = useState<string>('blue');
  const [lineWidth, setLineWidth] = useState<string>('semithick');
  const [tikzCode, setTikzCode] = useState<string>('');

  const tikzCodeOutputRef = useRef<HTMLTextAreaElement>(null);
  const tikzDiagramRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    renderTikz(tikzCode);
    if (tikzCodeOutputRef.current) {
      resizeTextarea(tikzCodeOutputRef.current);
    }
  }, [tikzCode]);

  useEffect(() => {
    const script = document.createElement("script");
    script.id = "tikzjax";
    script.type = "text/javascript";
    script.innerText = tikzjaxJs;
    document.body.appendChild(script);

    return () => {
      document.body.removeChild(script);
    };
  }, []);

  useEffect(() => {
    const handler = setTimeout(() => {
      generate(); // Run generate() after user stops typing
    }, 500); // Adjust delay as needed (e.g., 300-500ms)

    return () => clearTimeout(handler); // Cleanup timeout on each keystroke
  }, [states, initialState, acceptingStates, transitions, nodeDistance, innerSep, bendAngle, shorten, initialText, initialWhere, acceptingBy, arrowType, nodeColor, lineWidth]);

  const resizeTextarea = (element: HTMLTextAreaElement) => {
    element.style.height = 'auto';
    element.style.height = `${element.scrollHeight}px`;
  };

  const createTransitions = (transitionString: string): Transitions => {
    const transitionsList = transitionString.trim().split(';').filter(line => line.trim() !== '');
    const transitions: Transitions = {};

    transitionsList.forEach(transition => {
      const parts = transition.trim().split(',').map(part => part.trim());
      const fromState = parts.shift() || '';
      const toState = parts.pop() || '';
      const symbols = parts;

      if (!transitions[fromState]) {
        transitions[fromState] = {};
      }

      transitions[fromState][symbols.join(',')] = toState;
    });

    return transitions;
  };

  const checkTransition = (transitions: Transitions, s1: string, s2: string) => {
    const symbols: string[] = [];
    if (transitions[s1]) {
      for (const symbol in transitions[s1]) {
        if (transitions[s1][symbol] === s2) {
          symbols.push(symbol);
        }
      }
    }
    return symbols.length > 0 ? symbols.join(',') : false;
  };

  const checkConnection = (transitions: Transitions, stateA: string, stateB: string) => {
    if (checkTransition(transitions, stateA, stateB) && checkTransition(transitions, stateB, stateA)) {
      return 2;
    } else if (checkTransition(transitions, stateA, stateB) || checkTransition(transitions, stateB, stateA)) {
      return 1;
    }
    return 0;
  };

  const areElementsNextToEachOther = (arr: string[], e1: string, e2: string) => {
    for (let i = 0; i < arr.length - 1; i++) {
      if ((arr[i] === e1 && arr[i + 1] === e2) || (arr[i] === e2 && arr[i + 1] === e1)) {
        return true;
      }
    }
    return false;
  };

  const generate = () => {
    const acceptingStatesArray = acceptingStates.split(',').map(s => s.trim());
    let code = `\\usepackage{tikz}\n\\usetikzlibrary{automata, arrows.meta, positioning}\n\\begin{document}\n\\begin{tikzpicture}`;

    // Style
    code += `[
      shorten >=${shorten}pt,
      bend angle=${bendAngle},
      inner sep=${innerSep}pt,
      ${lineWidth},
      node distance=${nodeDistance}pt,
      >={${arrowType}},
      ${initialWhere ? `initial text=${initialText},` : `initial text=,`} 
      every state/.style={
        draw=${nodeColor},
        fill=${nodeColor}!20},
      accepting/.style=${acceptingBy},
      on grid]\n`;

    // Generate nodes
    const statesArray = states.split(/,|;/).map(s => s.trim()).filter(s => s !== '');
    const rows = states.split(';').map(row =>
      row.split(',').map(s => s.trim()).filter(s => s !== '')
    ).filter(row => row.length > 0);

    let previousRowFirstState: string | null = null;

    rows.forEach((row, rowIndex) => {
      let previousState: string | null = null;

      row.forEach((state, colIndex) => {
        let stateType = '';
        if (state === initialState) {
          stateType = `, initial${initialWhere ? ` ${initialWhere}` : ''}`;
        }
        if (acceptingStatesArray.includes(state)) {
          stateType += ', accepting';
        }

        if (colIndex === 0 && rowIndex > 0 && previousRowFirstState) {
          // First state of a new row, place it below the first state of the previous row
          code += `    \\node[state${stateType}] (${state}) [below of=${previousRowFirstState}] {$${state}$};\n`;
          previousRowFirstState = state;
        } else if (colIndex > 0 && previousState) {
          // Place to the right of the previous state in the row
          code += `    \\node[state${stateType}] (${state}) [right of=${previousState}] {$${state}$};\n`;
        } else {
          // First state of the first row
          code += `    \\node[state${stateType}] (${state}) {$${state}$};\n`;
          previousRowFirstState = state;
        }

        previousState = state;
      });
    });

    // Generate transitions
    const transitionsObj = createTransitions(transitions);

    statesArray.forEach((fromState, fromIndex) => {
      statesArray.forEach((toState, toIndex) => {
        // Loops
        if (fromState === toState && checkTransition(transitionsObj, fromState, toState)) {
          const nextIndex = toIndex + 1;
          const previousIndex = toIndex - 1;
          if (nextIndex < statesArray.length && checkConnection(transitionsObj, fromState, statesArray[nextIndex]) === 0) {
            code += `    \\draw (${fromState}) edge[loop right, ->] node{${checkTransition(transitionsObj, fromState, toState)}} (${fromState});\n`;
          } else if (previousIndex >= 0 && checkConnection(transitionsObj, fromState, statesArray[previousIndex]) === 0) {
            code += `    \\draw (${fromState}) edge[loop left, ->] node{${checkTransition(transitionsObj, fromState, toState)}} (${fromState});\n`;
          } else {
            code += `    \\draw (${fromState}) edge[loop below,->] node{${checkTransition(transitionsObj, fromState, toState)}} (${fromState});\n`;
          }
        } else if (checkTransition(transitionsObj, fromState, toState)) {
          if (areElementsNextToEachOther(statesArray, fromState, toState) && checkConnection(transitionsObj, fromState, toState) === 1) {
            code += `    \\draw (${fromState}) edge [above, ->] node{${checkTransition(transitionsObj, fromState, toState)}} (${toState});\n`;
          } else {
            if (fromIndex > toIndex) {
              code += `    \\draw (${fromState}) edge[bend right, above, ->] node{${checkTransition(transitionsObj, fromState, toState)}} (${toState});\n`;
            } else {
              code += `    \\draw (${fromState}) edge[bend right, below, ->] node{${checkTransition(transitionsObj, fromState, toState)}} (${toState});\n`;
            }
          }
        }
      });
    });

    code += `\\end{tikzpicture}\n\\end{document}`;
    setTikzCode(code);
  };



  const renderTikz = (code: string | null) => {
    if (!window.tikzjax) {
      console.error(window.tikzjax);
    }
    // In a real implementation, we'd need to handle TikZJax rendering here
    if (tikzDiagramRef.current && window.tikzjax) {
      // Clear previous diagram
      tikzDiagramRef.current.innerHTML = '';

      // Create a script element with the TikZ code
      const script = document.createElement('script');
      script.setAttribute('type', 'text/tikz');
      script.setAttribute('data-show-console', 'true');
      script.textContent = code;

      // Append the script to the diagram container
      tikzDiagramRef.current.appendChild(script);

      // Trigger TikZJax to render the diagram
      try {
        window.tikzjax.process(tikzDiagramRef.current);
      } catch (error) {
        console.error('Error rendering TikZ diagram:', error);
      }
    }
  }

  const copyToClipboard = () => {
    if (tikzCodeOutputRef.current) {
      tikzCodeOutputRef.current.select();
      document.execCommand('copy');
      const button = document.getElementById('copyToClipboard');
      if (button) {
        button.textContent = 'Copied!';
        setTimeout(() => {
          button.textContent = 'Copy to Clipboard';
        }, 2000);
      }
    }
  };

  const exportSVG = () => {
    const svg = document.querySelector("#tikzDiagram svg");
    if (svg) {
      let fontFaceRules = "";

      [...document.styleSheets].forEach(sheet => {
        try {
          [...sheet.cssRules].forEach(rule => {
            if (/cmr10|cmmi10/.test(rule.cssText)) fontFaceRules += rule.cssText + "\n";
          });
        } catch (err) { /* Ignore errors for cross-origin stylesheets */ }
      });

      const styleElement = document.createElementNS("http://www.w3.org/2000/svg", "style");
      styleElement.textContent = fontFaceRules;
      svg.prepend(styleElement);

      const svgString = new XMLSerializer().serializeToString(svg);
      const blob = new Blob([svgString], { type: "image/svg+xml" });
      const a = Object.assign(document.createElement("a"), {
        href: URL.createObjectURL(blob),
        download: "exported.svg"
      });

      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(a.href);
    }
  };


  return (
    <div className="container mx-auto p-2 max-w-3xl">
      <h1 className="font-bold mb-4 text-center">DFA State Diagram Generator</h1>
      <form className="space-y-2">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium" htmlFor="states">
              States: <code className="text-gray-500">state1, state2, ...</code>
            </label>
            <input
              className="w-full p-2 border border-gray-300 rounded-lg"
              type="text"
              id="states"
              value={states}
              onChange={(e) => setStates(e.target.value)}
            />
            <br />(use <code className="text-gray-500">;</code> for row break)
          </div>
          <div>
            <label className="block text-sm font-medium" htmlFor="initialState">
              Initial State:
            </label>
            <input
              className="w-full p-2 border border-gray-300 rounded-lg"
              type="text"
              id="initialState"
              value={initialState}
              onChange={(e) => setInitialState(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-sm font-medium" htmlFor="acceptingStates">
              Accepting States:
            </label>
            <input
              className="w-full p-2 border border-gray-300 rounded-lg"
              type="text"
              id="acceptingStates"
              value={acceptingStates}
              onChange={(e) => setAcceptingStates(e.target.value)}
            />
          </div>
        </div>
        <label className="block text-sm font-medium" htmlFor="transitions">
          Transitions: <code className="text-gray-500">fromState, symbol1, ... , toState; ...</code>
        </label>
        <textarea
          className="w-full p-2 border border-gray-300 rounded-lg h-32"
          id="transitions"
          value={transitions}
          onChange={(e) => {
            setTransitions(e.target.value);
            resizeTextarea(e.target);
          }}
        />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 bg-gray-300 p-4 rounded-lg">
          <h3 className="text-lg font-semibold">Style Options:</h3>
          <div>
            <label className="block text-sm font-medium" htmlFor="nodeDistance">
              Node Distance:
            </label>
            <input
              className="w-full p-2 border border-gray-300 rounded-lg"
              type="number"
              id="nodeDistance"
              value={nodeDistance}
              onChange={(e) => setNodeDistance(parseInt(e.target.value))}
            />
          </div>
          <div>
            <label className="block text-sm font-medium" htmlFor="innerSep">
              Inner Sep:
            </label>
            <input
              className="w-full p-2 border border-gray-300 rounded-lg"
              type="number"
              id="innerSep"
              value={innerSep}
              onChange={(e) => setInnerSep(parseInt(e.target.value))}
            />
          </div>
          <div>
            <label className="block text-sm font-medium" htmlFor="bendAngle">
              Bend Angle:
            </label>
            <input
              className="w-full p-2 border border-gray-300 rounded-lg"
              type="number"
              id="bendAngle"
              value={bendAngle}
              onChange={(e) => setBendAngle(parseInt(e.target.value))}
            />
          </div>
          <div>
            <label className="block text-sm font-medium" htmlFor="shorten">
              Shorten:
            </label>
            <input
              className="w-full p-2 border border-gray-300 rounded-lg"
              type="number"
              id="shorten"
              value={shorten}
              onChange={(e) => setShorten(parseInt(e.target.value))}
            />
          </div>
          <div>
            <label className="block text-sm font-medium" htmlFor="initialText">
              Initial Text:
            </label>
            <input
              className="w-full p-2 border border-gray-300 rounded-lg"
              type="text"
              id="initialText"
              value={initialText}
              onChange={(e) => setInitialText(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-sm font-medium" htmlFor="initialWhere">
              Initial Where:
            </label>
            <select
              className="w-full p-2 border border-gray-300 rounded-lg"
              id="initialWhere"
              value={initialWhere}
              onChange={(e) => setInitialWhere(e.target.value)}
            >
              <option value="above">Above</option>
              <option value="below">Below</option>
              <option value="left">Left</option>
              <option value="right">Right</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium" htmlFor="acceptingBy">
              Accepting By:
            </label>
            <select
              className="w-full p-2 border border-gray-300 rounded-lg"
              id="acceptingBy"
              value={acceptingBy}
              onChange={(e) => setAcceptingBy(e.target.value)}
            >
              <option value="accepting by arrow">arrow</option>
              <option value="accepting by double">double</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium" htmlFor="arrowType">
              Arrow Type:
            </label>
            <select
              className="w-full p-2 border border-gray-300 rounded-lg"
              id="arrowType"
              value={arrowType}
              onChange={(e) => setArrowType(e.target.value)}
            >
              <option value="Stealth[round]">Stealth[round]</option>
              <option value="Latex">Latex</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium" htmlFor="nodeColor">
              Node Color:
            </label>
            <input
              className="w-full p-2 border border-gray-300 rounded-lg"
              type="text"
              id="nodeColor"
              value={nodeColor}
              onChange={(e) => setNodeColor(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-sm font-medium" htmlFor="lineWidth">
              Line Width:
            </label>
            <select
              className="w-full p-2 border border-gray-300 rounded-lg"
              id="lineWidth"
              value={lineWidth}
              onChange={(e) => setLineWidth(e.target.value)}
            >
              <option value="semithick">Semithick</option>
              <option value="thick">Thick</option>
              <option value="very thick">Very Thick</option>
            </select>
          </div>
        </div>
      </form>
      <div id="tikzDiagram" ref={tikzDiagramRef} className="mt-6 p-4 bg-white shadow-md rounded-lg flex justify-center"></div>
      <div className="flex justify-center space-x-4 mt-4">
        <button
          className="px-4 py-2 bg-blue-500 text-white rounded-lg shadow hover:bg-blue-600 cursor-pointer"
          type="button"
          id="copyToClipboard"
          onClick={copyToClipboard}
        >
          Copy to Clipboard
        </button>
        <button
          className="px-4 py-2 bg-green-500 text-white rounded-lg shadow hover:bg-green-600 cursor-pointer"
          type="button"
          id="exportSVG"
          onClick={exportSVG}
        >
          Export SVG
        </button>
      </div>
      <textarea
        id="tikzCodeOutput"
        ref={tikzCodeOutputRef}
        className="mt-6 resize-none w-full p-2 border border-gray-300 rounded-md"
        value={tikzCode}
        onChange={(e) => setTikzCode(e.target.value)}

      />
      <footer className="text-center m-8 text-gray-500">
        <div>
          source:
          <a
            href="https://github.com/adielBm/tikz-automata-generator/tree/main"
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-500 hover:text-blue-700"
          >
            github.com/adielBm/tikz-automata-generator
          </a>
        </div>
        <div>docs: 
          <a
            href="https://tikz.dev/library-automata"
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-500 hover:text-blue-700"
          >
            tikz.dev/library-automata
          </a>
        </div>
      </footer>
    </div>
  );
};

export default DFAGenerator;