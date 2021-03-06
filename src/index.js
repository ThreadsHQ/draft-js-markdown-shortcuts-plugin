import React from 'react';
import {
  blockRenderMap as checkboxBlockRenderMap,
  CheckableListItem,
  CheckableListItemUtils,
  CHECKABLE_LIST_ITEM
} from 'draft-js-checkable-list-item';

import { Map } from 'immutable';

import adjustBlockDepth from './modifiers/adjustBlockDepth';
import handleBlockType from './modifiers/handleBlockType';
import handleInlineStyle from './modifiers/handleInlineStyle';
import handleNewCodeBlock from './modifiers/handleNewCodeBlock';
import insertEmptyBlock from './modifiers/insertEmptyBlock';
import handleLink from './modifiers/handleLink';
import handleImage from './modifiers/handleImage';
import leaveList from './modifiers/leaveList';
import insertText from './modifiers/insertText';
import changeCurrentBlockType from './modifiers/changeCurrentBlockType';
import createLinkDecorator from './decorators/link';
import createImageDecorator from './decorators/image';
import { replaceText } from './utils';

const INLINE_STYLE_CHARACTERS = [' ', '*', '_'];

function checkCharacterForState(editorState, character) {
  let newEditorState = handleBlockType(editorState, character);
  if (editorState === newEditorState) {
    newEditorState = handleImage(editorState, character);
  }
  if (editorState === newEditorState) {
    newEditorState = handleLink(editorState, character);
  }
  if (editorState === newEditorState) {
    newEditorState = handleInlineStyle(editorState, character);
  }
  return newEditorState;
}

function checkReturnForState(editorState, ev) {
  let newEditorState = editorState;
  const contentState = editorState.getCurrentContent();
  const selection = editorState.getSelection();
  const key = selection.getStartKey();
  const currentBlock = contentState.getBlockForKey(key);
  const type = currentBlock.getType();
  const text = currentBlock.getText();

  if (text === '---') {
    newEditorState = changeCurrentBlockType(editorState, 'horizontal-rule', '');
    return insertEmptyBlock(newEditorState);
  }

  if (/-list-item$/.test(type) && text === '') {
    return leaveList(editorState);
  }

  if (type !== 'code-block' && /^```([\w-]+)?$/.test(text)) {
    return handleNewCodeBlock(editorState);
  }
  // if (newEditorState === editorState && type === 'code-block') {
  //   if (/```\s*$/.test(text)) {
  //     newEditorState = changeCurrentBlockType(newEditorState, type, text.replace(/\n```\s*$/, ''));
  //     newEditorState = insertEmptyBlock(newEditorState);
  //   } else {
  //     newEditorState = insertText(editorState, '\n');
  //   }
  // }

  return newEditorState;
}

const createMarkdownShortcutsPlugin = (config = {}) => {
  const store = {};
  return {
    store,
    blockRenderMap: Map({
      'code-block': {
        element: 'code',
        wrapper: <pre spellCheck={'false'} />
      }
    }).merge(checkboxBlockRenderMap),
    decorators: [
      createLinkDecorator(config, store),
      createImageDecorator(config, store)
    ],
    initialize({ setEditorState, getEditorState }) {
      store.setEditorState = setEditorState;
      store.getEditorState = getEditorState;
    },
    blockStyleFn(block) {
      switch (block.getType()) {
        case CHECKABLE_LIST_ITEM:
          return CHECKABLE_LIST_ITEM;
        default:
          break;
      }
      return null;
    },

    blockRendererFn(block, { setEditorState, getEditorState }) {
      switch (block.getType()) {
        case CHECKABLE_LIST_ITEM: {
          return {
            component: CheckableListItem,
            props: {
              onChangeChecked: () => setEditorState(
                CheckableListItemUtils.toggleChecked(getEditorState(), block)
              ),
              checked: !!block.getData().get('checked'),
            },
          };
        }
        default:
          return null;
      }
    },
    onTab(ev, { getEditorState, setEditorState }) {
      const editorState = getEditorState();
      const newEditorState = adjustBlockDepth(editorState, ev);
      if (newEditorState !== editorState) {
        setEditorState(newEditorState);
        return 'handled';
      }
      return 'not-handled';
    },
    handleReturn(ev, editorState, { setEditorState }) {
      const newEditorState = checkReturnForState(editorState, ev);
      if (editorState !== newEditorState) {
        setEditorState(newEditorState);
        return 'handled';
      }
      return 'not-handled';
    },
    handleBeforeInput(character, editorState, { setEditorState }) {
      if (character !== ' ') {
        return 'not-handled';
      }
      const newEditorState = checkCharacterForState(editorState, character);
      if (editorState !== newEditorState) {
        setEditorState(newEditorState);
        return 'handled';
      }
      return 'not-handled';
    },
    handlePastedText(text, html, editorState, { setEditorState }) {
      if (html) {
        return 'not-handled';
      }
      let newEditorState = editorState;
      let buffer = [];
      for (let i = 0; i < text.length; i++) { // eslint-disable-line no-plusplus
        if (INLINE_STYLE_CHARACTERS.indexOf(text[i]) >= 0) {
          newEditorState = replaceText(newEditorState, buffer.join('') + text[i]);
          newEditorState = checkCharacterForState(newEditorState, text[i]);
          buffer = [];
        } else if (text[i].charCodeAt(0) === 10) {
          newEditorState = replaceText(newEditorState, buffer.join(''));
          const tmpEditorState = checkReturnForState(newEditorState, {});
          if (newEditorState === tmpEditorState) {
            newEditorState = insertEmptyBlock(tmpEditorState);
          } else {
            newEditorState = tmpEditorState;
          }
          buffer = [];
        } else if (i === text.length - 1) {
          newEditorState = replaceText(newEditorState, buffer.join('') + text[i]);
          buffer = [];
        } else {
          buffer.push(text[i]);
        }
      }

      if (editorState !== newEditorState) {
        setEditorState(newEditorState);
        return 'handled';
      }
      return 'not-handled';
    }
  };
};

export default createMarkdownShortcutsPlugin;
