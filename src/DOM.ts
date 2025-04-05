import { createElement } from 'react';

const elm = createElement;

export const h1 = (props: any, ...children: any[]) => elm('h1', props, ...children);
export const div = (props: any, ...children: any[]) => elm('div', props, ...children);
export const button = (props: any, ...children: any[]) => elm('button', props, ...children);
export const p = (props: any, ...children: any[]) => elm('p', props, ...children);
export const code = (props: any, ...children: any[]) => elm('code', props, ...children);
export const fragment = (props: any, ...children: any[]) => elm('fragment', props, ...children);

// You can also export a default DOM object if you want both options
export default {
    h1, div, button, p, code, fragment
};
