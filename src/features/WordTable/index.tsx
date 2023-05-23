import Fuse from "fuse.js";
import React, { useEffect, useState } from "react";
import { Card } from "../../types/storageTypes";
import { Text } from "../../components/Text";
import { UseFolderContext } from "../App";
import { TableHeader } from "./TableHeader";
import { WordPanel } from "./WordPanel";
import css from "./index.module.css";
import searchEmpty from "../../assets/searchEmpty.svg";
import folderEmpty from "../../assets/folderEmpty.svg";
import classNames from "classnames";
import { handleRowSelect } from "../../utils/rangeSelect";
import { copyFlashcards } from "../../utils/file";

const Placeholder = ({
  image,
  text,
  className,
}: {
  image: string;
  text: string;
  className?: string;
}) => {
  return (
    <div className={css.placeholder + " " + className}>
      <img src={image} alt="" height={100} />
      <Text type="heading">{text}</Text>
    </div>
  );
};

const WordTable = ({
  cards,
  moveCards,
  deleteCards,
}: {
  /** Most recent cards are at the end, so this is reversed when displaying the table */
  cards: Card[];
  moveCards: (cardIds: string[], folderIds: string[]) => void;
  deleteCards: (cardIds: string[]) => void;
}) => {
  const { activeFolderId, selectedFolderIds } = UseFolderContext();
  const [activeCardIds, setActiveCardsIds] = useState<string[]>([]);
  const [searchInput, setInput] = useState("");
  const pivotIndexRef = React.useRef(0); //I know this should be ideally in the search util

  //Search
  const fuse = new Fuse(cards, {
    keys: ["front.text", "back.text"],
  });

  const filteredCards = !searchInput.length
    ? [...cards].reverse() //don't mutate the original array or bad things will happen...
    : fuse.search(searchInput).map((result) => result.item);

  const activeCards = filteredCards.filter((card) =>
    activeCardIds.includes(card.id)
  );

  // Deselect any selected cards that go off into the abyss when a filter query is typed
  useEffect(() => {
    const newActiveCardsIds = activeCardIds.filter((cardId) =>
      filteredCards.some((card) => card.id === cardId)
    );
    if (newActiveCardsIds.length < activeCardIds.length)
      setActiveCardsIds(newActiveCardsIds); //we don't want an infinite loop - that's why this conditional check is here
  }, [filteredCards, activeCardIds]);

  /** Selects the next card in the table if only one card is currently selected */
  const selectNewCard = () => {
    const nextIndex =
      activeCardIds.length === 1
        ? filteredCards.findIndex((card) => card.id === activeCardIds[0]) + 1
        : filteredCards.length;

    if (nextIndex < filteredCards.length && nextIndex >= 0) {
      setActiveCardsIds([filteredCards[nextIndex].id]);
    } else {
      setActiveCardsIds([]);
    }
  };
  const handleKeyboardShortcuts = (
    event: React.KeyboardEvent<HTMLTableRowElement>
  ) => {
    if (event.key === "Escape") {
      setActiveCardsIds([]);
      event.preventDefault();
    }
    if (event.key === "a" && (event.metaKey || event.ctrlKey)) {
      setActiveCardsIds(filteredCards.map((card) => card.id));
      event.preventDefault();
    }
    if (event.key === "c" && (event.metaKey || event.ctrlKey))
      copyFlashcards(activeCards);
  };
  return (
    <div className={css.container}>
      <TableHeader
        folderName={activeFolderId}
        setSearchInput={setInput}
        cards={cards}
        filteredCards={filteredCards}
      />
      {filteredCards.length ? (
        <div className={css.tableContainer} onKeyDown={handleKeyboardShortcuts}>
          <table>
            <thead>
              <tr>
                <th>
                  <Text type="subheading">Original</Text>
                </th>
                <th>
                  <Text type="subheading">Translation</Text>
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredCards.map((card) => (
                <tr
                  key={card.id}
                  onMouseDown={(ev) =>
                    setActiveCardsIds(
                      handleRowSelect(
                        ev,
                        card.id,
                        filteredCards.map((card) => card.id),
                        activeCardIds,
                        pivotIndexRef
                      )
                    )
                  }
                  tabIndex={0}
                  className={classNames({
                    [css.selected]: activeCardIds.includes(card.id),
                  })}
                >
                  <td>
                    <Text
                      type="paragraph"
                      noWrap
                      dull={
                        activeCardIds.length > 0 &&
                        !activeCardIds.includes(card.id)
                      }
                    >
                      {card.front.text}
                    </Text>
                  </td>
                  <td>
                    <Text
                      type="paragraph"
                      noWrap
                      dull={
                        activeCardIds.length > 0 &&
                        !activeCardIds.includes(card.id)
                      }
                    >
                      {card.back.text}
                    </Text>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : cards.length ? (
        <Placeholder image={searchEmpty} text="No cards match your search" />
      ) : (
        <Placeholder
          image={folderEmpty}
          text="This folder is currently empty"
        />
      )}
      {activeCards.length > 0 && (
        <WordPanel
          cards={activeCards}
          saveCard={() => {
            selectNewCard();
            moveCards(activeCardIds, selectedFolderIds.filter((id) => id !== activeFolderId));
          }}
          deleteCard={() => {
            selectNewCard();
            deleteCards(activeCardIds);
          }}
        />
      )}
    </div>
  );
};

export default WordTable;
