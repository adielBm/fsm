// Define TikzJax for TypeScript
declare global {
    interface Window {
        tikzjax?: {
            process: (element: HTMLElement) => void;
        };
    }
}

export { };