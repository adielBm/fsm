import React, { useState, useEffect, useRef } from 'react';
import './App.css';
import tikzjaxJs from "./tikzjax.js?raw"; // For Vite (bundler must support ?raw)
import Editor from "react-simple-code-editor";
import Prism from "prismjs";
import "prismjs/themes/prism.css";
import { highlight, languages } from 'prismjs';
import 'prismjs/components/prism-latex';
import 'prismjs/components/prism-ada';

interface Transition {
  [symbol: string]: string[];
}

interface Transitions {
  [fromState: string]: Transition;
}

function getPermutations<T>(arr: T[]): T[][] {
  if (arr.length === 0) return [[]];
  return arr.flatMap((v, i) =>
    getPermutations([...arr.slice(0, i), ...arr.slice(i + 1)]).map(p => [v, ...p])
  );
}

function calculateTransitionCost(statePositions: Record<string, [number, number]>, transitions: Record<string, Record<string, string[]>>): number {
  let totalCost = 0;

  for (const fromState in transitions) {
    for (const symbol in transitions[fromState]) {
      for (const toState of transitions[fromState][symbol]) {
        if (fromState in statePositions && toState in statePositions) {
          const [x1, y1] = statePositions[fromState];
          const [x2, y2] = statePositions[toState];
          totalCost += Math.abs(x1 - x2) + Math.abs(y1 - y2); // Manhattan Distance
        }
      }
    }
  }
  return totalCost;
}

function findOptimalStatePlacement(states: string[], initState: string, acceptingStates: string[], transitions: Record<string, Record<string, string[]>>): string[][] {
  const n = states.length;
  const gridSize = Math.ceil(Math.sqrt(n));

  const allPermutations = getPermutations(states)

  let bestGrid: string[][] = [];
  let minCost = Infinity;

  let count = 0;

  for (const perm of allPermutations) {
    const grid: string[][] = Array.from({ length: gridSize }, () => Array(gridSize).fill(null));
    const statePositions: Record<string, [number, number]> = {};

    perm.forEach((state, index) => {
      const row = Math.floor(index / gridSize);
      const col = index % gridSize;
      grid[row][col] = state;
      statePositions[state] = [row, col];
    });

    if (count % 1000 === 0) {
      console.log('count', count);
      console.log('grid');
      console.log(grid);
    }
    count++;

    // Check if the initial state is on the some leftmost column of some row, if not, ignore this permutation
    if (!grid.some(row => row[0] === initState)) continue;
    // Check if not(every non-null-rightmost element of each row is an accepting state) && (some row has accepting state as element that is not non-null-rightmost element)
    if (!grid.every((row) => {
      // first find the rightmost element of the row that is not null, if there is no such element, return true
      const rightmost = row.findLastIndex(cell => cell !== null);
      return acceptingStates.includes(row[rightmost]) || rightmost === -1;
    }) && grid.some((row) => {
      const rightmost = row.findLastIndex(cell => cell !== null);
      // loop through the row from 0 to rightmost (exclusive) and check if there is an accepting state
      if (rightmost === -1) return false;
      return row.slice(0, rightmost).some(cell => acceptingStates.includes(cell) && cell !== initState);
    })) continue;

    const cost = calculateTransitionCost(statePositions, transitions);
    if (cost < minCost) {
      minCost = cost;
      bestGrid = grid;
    }
  }

  return bestGrid;
}


const Generator: React.FC = () => {
  const [states, setStates] = useState<string>('q1, q2, q3, q4');
  const [initialState, setInitialState] = useState<string>('q1');
  const [acceptingStates, setAcceptingStates] = useState<string>('q3,q2');
  const [transitions, setTransitions] = useState<string>('q3, 1, q2;\nq1, 0, 1, q1;\nq1, 1, q2;\nq2, 0, 1, q3;\nq3, 0, 1, q4;\nq4, 0, 1, q4;\nq2, 1, q4;');
  // style options
  const [nodeDistance, setNodeDistance] = useState<number>(120);
  const [innerSep, setInnerSep] = useState<number>(4);
  const [bendAngle, setBendAngle] = useState<number>(30);
  const [shorten, setShorten] = useState<number>(3);
  const [initialText, setInitialText] = useState<string>('start');
  const [initialWhere, setInitialWhere] = useState<string>('left');
  const [acceptingBy, setAcceptingBy] = useState<string>('accepting by double');
  const [doubleDistance, setDoubleDistance] = useState<number>(1.5);
  const [arrowType, setArrowType] = useState<string>('Stealth[round]');
  // colors
  const [nodeFillColor, setNodeFillColor] = useState<string | null>('f0f0f0')
  const [nodeBorderColor, setNodeBorderColor] = useState<string | null>(null)
  const [edgeColor, setEdgeColor] = useState<string | null>(null)

  const [lineWidth, setLineWidth] = useState<string>('thick');
  const [tikzCode, setTikzCode] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const tikzDiagramRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setLoading(true);
    const handler = setTimeout(() => {
      renderTikz(tikzCode);
      setLoading(false);
    }, 1000);
    return () => clearTimeout(handler);
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
    setLoading(true);
    const handler = setTimeout(() => {
      generate(); // Run generate() after user stops typing
    }, 500); // Adjust delay as needed (e.g., 300-500ms)

    return () => clearTimeout(handler); // Cleanup timeout on each keystroke
  }, [states, initialState, acceptingStates, transitions, nodeDistance, innerSep, bendAngle, shorten, initialText, initialWhere, acceptingBy, doubleDistance, arrowType, nodeFillColor, lineWidth, nodeBorderColor, edgeColor]);


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
      if (!transitions[fromState][symbols.join(',')]) {
        transitions[fromState][symbols.join(',')] = [];
      }
      transitions[fromState][symbols.join(',')].push(toState);
    });

    return transitions;
  };

  const checkTransition = (transitions: Transitions, s1: string, s2: string) => {
    const symbols: string[] = [];
    if (transitions[s1]) {
      for (const symbol in transitions[s1]) {
        if (transitions[s1][symbol].includes(s2)) {
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

  const getEdge = (grid: string[][], item: string): string | null => {
    // Iterate over the grid to find the position of the item
    for (let i = 0; i < grid.length; i++) {
      for (let j = 0; j < grid[i].length; j++) {
        if (grid[i][j] === item) {
          // Check for each direction (top, bottom, left, right)

          // Top edge
          if (i === 0 || grid[i - 1][j] === null) {
            return "above";
          }
          // Bottom edge
          if (i === grid.length - 1 || grid[i + 1][j] === null) {
            return "below";
          }
          // Left edge
          if (j === 0 || grid[i][j - 1] === null) {
            return "left";
          }
          // Right edge
          if (j === grid[i].length - 1 || grid[i][j + 1] === null) {
            return "right";
          }
        }
      }
    }
    return null; // Return null if item not found
  }

  const doesLineCrossOtherElements = (arr2d: string[][], e1: string, e2: string): boolean => {
    const findPosition = (element: string): [number, number] | null => {
      for (let i = 0; i < arr2d.length; i++) {
        for (let j = 0; j < arr2d[i].length; j++) {
          if (arr2d[i][j] === element) {
            return [i, j];
          }
        }
      }
      return null;
    };

    const pos1 = findPosition(e1);
    const pos2 = findPosition(e2);

    if (!pos1 || !pos2) return false;

    const [x1, y1] = pos1;
    const [x2, y2] = pos2;

    // Check all elements between (x1, y1) and (x2, y2)
    for (let i = 0; i < arr2d.length; i++) {
      for (let j = 0; j < arr2d[i].length; j++) {
        if ((i === x1 && j === y1) || (i === x2 && j === y2)) continue; // Skip e1 and e2

        // Check if (i, j) is on the line passing through (x1, y1) and (x2, y2)
        if ((x2 - x1) * (j - y1) === (y2 - y1) * (i - x1)) {
          // Check if the point (i, j) is between (x1, y1) and (x2, y2)
          if (
            Math.min(x1, x2) <= i && i <= Math.max(x1, x2) &&
            Math.min(y1, y2) <= j && j <= Math.max(y1, y2)
          ) {
            return true; // Another element is crossed
          }
        }
      }
    }
    return false;
  };

  // check if two elements are next to each other in a 2d array (row-wise/col-wise/diagonal)
  // const areElementsNextToEachOther = (arr2d: string[][], e1: string, e2: string) => {
  //   const [r1, c1] = arr2d.reduce((acc, row, rowIndex) => {
  //     const colIndex = row.indexOf(e1);
  //     if (colIndex !== -1) {
  //       acc = [rowIndex, colIndex];
  //     }
  //     return acc;
  //   }, [-1, -1]);
  //   return false;
  // };

  const formatState = (str: string) => {
    const pattern = /^[A-Za-z](\d+)?$/; // Matches a letter followed by optional digits
    if (pattern.test(str) && str.length >=2) {
      return `$${str[0]}_{${str.slice(1)}}$`; // Format as LaTeX
    }
    return `$${str}$`; // Default format
  }

  const generate = () => {
    const acceptingStatesArray = acceptingStates.split(',').map(s => s.trim());
    let code = `\\usepackage{tikz}\n\\usetikzlibrary{automata, arrows.meta, positioning}\n\\begin{document}\n`;

    if (nodeFillColor) {
      code += `\\definecolor{nodeFillColor}{HTML}{${nodeFillColor.replace('#', '')}}\n`;
    }
    if (nodeBorderColor) {
      code += `\\definecolor{nodeBorderColor}{HTML}{${nodeBorderColor.replace('#', '')}}\n`;
    }
    if (edgeColor) {
      code += `\\definecolor{edgeColor}{HTML}{${edgeColor.replace('#', '')}}\n`;
    }

    code += `\\begin{tikzpicture}`;

    // Style
    code += `[
      shorten >=${shorten}pt,
      bend angle=${bendAngle},
      inner sep=${innerSep}pt,
      ${lineWidth},
      node distance=${nodeDistance}pt,
      >={${arrowType}},
      ${initialWhere ? `initial text=${initialText},` : `initial text=,`}`;
    // every state/.style={
    //   draw=${nodeColor},
    //   fill=${nodeColor}!20},
    // `;

    if (nodeFillColor || nodeBorderColor) {
      code += `\nevery state/.style={`;
      if (nodeFillColor) {
        code += `fill=nodeFillColor,`;
      }
      if (nodeBorderColor) {
        code += `draw=nodeBorderColor,`;
      }
      code += `},\n`;
    }
    if (edgeColor) {
      code += `every edge/.style={draw=edgeColor},\n`;
    }

    if (acceptingBy === 'accepting by double') {
      code += `accepting by double/.style={double, double distance=${doubleDistance}pt},\n`;
    } else {
      code += `accepting/.style=accepting by arrow,\n`;
    }

    code += `on grid]\n`;

    // Generate transitions
    const transitionsObj: Transitions = createTransitions(transitions);
    // console.log(transitionsObj);

    // Generate nodes
    const statesArray = states.split(/,|;/).map(s => s.trim()).filter(s => s !== '');

    // Auto layout
    const optimalStatePlacement = findOptimalStatePlacement(statesArray, initialState, acceptingStatesArray, transitionsObj);
    let previousRowFirstState: string | null = null;
    optimalStatePlacement.forEach((row, rowIndex) => {
      let previousState: string | null = null;
      row.forEach((state, colIndex) => {
        if (state) {
          let stateType = state == initialState ? `, initial${initialWhere ? ` ${initialWhere}` : ''}` : '';
          if (acceptingStatesArray.includes(state)) {
            stateType += ', accepting';
          }
          // statePositions[state] = [colIndex * 2, -rowIndex * 2];
          if (colIndex === 0 && rowIndex > 0 && previousRowFirstState) {
            code += `\t\\node[state${stateType}] (${state}) [below of=${previousRowFirstState}] {${formatState(state)}};\n`;
            previousRowFirstState = state;
          } else if (colIndex > 0 && previousState) {
            code += `\t\\node[state${stateType}] (${state}) [right of=${previousState}] {${formatState(state)}};\n`;
          } else {
            code += `\t\\node[state${stateType}] (${state}) {${formatState(state)}};\n`;
            previousRowFirstState = state;
          }
          previousState = state;

        }
      });
    });


    statesArray.forEach((fromState, fromIndex) => {
      statesArray.forEach((toState, toIndex) => {
        // Loops
        if (fromState === toState && checkTransition(transitionsObj, fromState, toState)) {

          // NEW
          // if the state is on the edge of the grid (top, right, bottom, left) then draw the loop in the opposite direction
          const loopPos = getEdge(optimalStatePlacement, fromState) || 'below';
          code += `    \\draw (${fromState}) edge[loop ${loopPos}, ->] node[auto]{${checkTransition(transitionsObj, fromState, toState)}} (${fromState});\n`;






          // OLD
          // if (nextIndex < statesArray.length && checkConnection(transitionsObj, fromState, statesArray[nextIndex]) === 0) {
          //   code += `    \\draw (${fromState}) edge[loop right, ->] node{${checkTransition(transitionsObj, fromState, toState)}} (${fromState});\n`;
          // } else if (previousIndex >= 0 && checkConnection(transitionsObj, fromState, statesArray[previousIndex]) === 0) {
          //   code += `    \\draw (${fromState}) edge[loop left, ->] node{${checkTransition(transitionsObj, fromState, toState)}} (${fromState});\n`;
          // } else {
          //   code += `    \\draw (${fromState}) edge[loop below,->] node{${checkTransition(transitionsObj, fromState, toState)}} (${fromState});\n`;
          // }
        } else if (checkTransition(transitionsObj, fromState, toState)) {
          if (!doesLineCrossOtherElements(optimalStatePlacement, fromState, toState) && checkConnection(transitionsObj, fromState, toState) === 1) {
            code += `    \\draw (${fromState}) edge [above, ->] node[auto]{${checkTransition(transitionsObj, fromState, toState)}} (${toState});\n`;
          } else {
            if (fromIndex > toIndex) {
              code += `    \\draw (${fromState}) edge[bend right, above, ->] node[auto]{${checkTransition(transitionsObj, fromState, toState)}} (${toState});\n`;
            } else {
              code += `    \\draw (${fromState}) edge[bend right, below, ->] node[auto]{${checkTransition(transitionsObj, fromState, toState)}} (${toState});\n`;
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
    navigator.clipboard.writeText(tikzCode).then(() => {
      const button = document.getElementById('copyToClipboard');
      if (button) {
        button.textContent = 'Copied!';
        setTimeout(() => {
          button.textContent = 'Copy to Clipboard';
        }, 2000);
      }
    });
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
      <h1 className="font-bold text-center">Finite Automaton Diagram Generator</h1>
      <p className="text-center text-gray-500">
        Generate <a href="https://en.wikipedia.org/wiki/PGF/TikZ" target="_blank" rel="noopener noreferrer">TikZ</a> (with <a href="https://tikz.dev/library-automata" target="_blank" rel="noopener noreferrer">automata</a> library) code for a diagram of <a href="https://en.wikipedia.org/wiki/Finite-state_machine" target="_blank">finite automaton</a> (DFA/NFA).
      </p>
      <hr className='my-4'></hr>
      <form className="space-y-2">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label htmlFor="states">
              States: <code className="text-gray-600">state1, state2, ...</code>
            </label>
            <input
              className="w-full p-2 border border-gray-300 rounded-lg"
              type="text"
              id="states"
              value={states}
              onChange={(e) => setStates(e.target.value)}
            />
          </div>
          <div>
            <label htmlFor="initialState">
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
            <label htmlFor="acceptingStates">
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
        <label htmlFor="transitions">
          Transitions: <code className="text-gray-600">fromState, symbol1, ... , toState; ...</code>
        </label>
        <Editor
          id="transitions-editor"
          className="w-full"
          value={transitions}
          onValueChange={(code) => setTransitions(code)}
          highlight={(code) => Prism.highlight(code, languages.ada, 'ada')}
          padding={10}
          style={{ fontFamily: "monospace", backgroundColor: "white", fontSize: 14 }}
        />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 bg-gray-200 p-4 rounded-lg">
          <h3 className="text-lg font-semibold">Style Options:</h3>
          <div>
            <label htmlFor="nodeDistance">
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
            <label htmlFor="innerSep">
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
            <label htmlFor="bendAngle">
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
            <label htmlFor="shorten">
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
            <label htmlFor="initialText">
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
            <label htmlFor="initialWhere">
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
            <label htmlFor="acceptingBy">
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
            <label htmlFor="doubleDistance">
              Double Distance:
            </label>
            <input
              className="w-full p-2 border border-gray-300 rounded-lg"
              type="number"
              step="0.5"
              min="0.0"
              id="doubleDistance"
              value={doubleDistance}
              onChange={(e) => setDoubleDistance(parseFloat(e.target.value))}
            />
          </div>
          <div>
            <label htmlFor="arrowType">
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
            <label htmlFor="nodeColor">
              Node Fill Color:
            </label>
            <input
              className="w-full border border-gray-300 rounded-lg"
              type="color"
              id="nodeFillColor"
              value={nodeFillColor || ''}
              onChange={(e) => setNodeFillColor(e.target.value)}
            />
          </div>
          <div>
            <label htmlFor="nodeBorderColor">
              Node Border Color:
            </label>
            <input
              className="w-full border border-gray-300 rounded-lg"
              type="color"
              id="nodeBorderColor"
              value={nodeBorderColor || ''}
              onChange={(e) => setNodeBorderColor(e.target.value)}
            />
          </div>
          <div>
            <label htmlFor="edgeColor">
              Edge Color:
            </label>
            <input
              className="w-full border border-gray-300 rounded-lg"
              type="color"
              id="edgeColor"
              value={edgeColor || ''}
              onChange={(e) => setEdgeColor(e.target.value)}
            />
          </div>
          <div>
            <label htmlFor="lineWidth">
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
      <div id="tikzDiagram" ref={tikzDiagramRef} className={`${loading ? 'loading' : ''} mt-6 p-4 bg-white shadow-md rounded-lg flex justify-center`} ></div>
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
      <Editor
        id="tikz-editor"
        className="mt-6"
        value={tikzCode}
        onValueChange={(code) => setTikzCode(code)}
        highlight={(code) => highlight(code, languages.latex, 'latex')}
        padding={10}
        style={{ fontFamily: "monospace", backgroundColor: "white" }}
      />
      <footer className="text-center m-8 text-gray-500">
        <div>
          source code: <a
            href="https://github.com/adielBm/dfa/"
            target="_blank"
            rel="noopener noreferrer"
          >
            github.com/adielBm/dfa
          </a>
        </div>

      </footer>
    </div>
  );
};

export default Generator;