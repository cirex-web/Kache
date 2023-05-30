import { Icon } from "../../components/Icon";
import { Text } from "../../components/Text";
import { Folder } from "../../types/storageTypes";
import { RecursiveFolder } from "./RecursiveFolder";
import css from "./index.module.css";
import { FileDirectory } from "../../types/folderTypes";
import { Button } from "../../components/Button";
import { handleRowSelect } from "../../utils/rangeSelect";
import { UseFolderContext } from "../App";
import React, { useMemo } from "react";
import {
  generateTreeStructure,
  getOrderedFolderIds,
} from "../../utils/storage/folders";

export const FolderNav = ({
  folders,
  addFolder,
  deleteFolder,
  renameFolder,
}: {
  folders: Folder[];
  addFolder: (fileName: string, parentFolderId?: string) => void;
  deleteFolder: () => void;
  renameFolder: (fileName: string, folderId: string) => void;
}) => {
  const fileTree: FileDirectory[] = useMemo(
    () => generateTreeStructure(folders),
    [folders]
  ); //don't regenerate the tree unless folders changes
  const {
    selectedFolderIds,
    activeFolderId,
    setSelectedFolderIds,
    moveFolder,
  } = UseFolderContext();

  const pivotPointRef = React.useRef(0);

  const handleFolderSelect = (
    ev: React.MouseEvent<HTMLSpanElement, MouseEvent>,
    folder: string
  ) => {
    const folderIds = getOrderedFolderIds(fileTree);
    const selectedIds = handleRowSelect(
      ev,
      folder,
      folderIds,
      selectedFolderIds,
      pivotPointRef
    );
    setSelectedFolderIds(
      folderIds.filter((folderId) => selectedIds.includes(folderId))
    );
  };

  return (
    <div className={css.container}>
      <Text type="heading" bold className={css.title}>
        <Icon name="folder" />
        Folders
        <Text type="xLargeHeading" className={css.buttonContainer}>
          <Button
            onMouseDown={() => addFolder("New Folder", activeFolderId)}
            zoomOnHover
          >
            <Icon name="Add" />
          </Button>
          <Button onMouseDown={deleteFolder} zoomOnHover>
            <Icon name="Remove" />
          </Button>
        </Text>
      </Text>
      {fileTree.map((folders) => (
        <RecursiveFolder
          folder={folders}
          setSelectedFolders={handleFolderSelect} //folders does not include nestedFolders
          changeFolderName={renameFolder}
          moveFolder={(src: string, dest: string) => moveFolder(src, dest)}
          key={folders.id}
        />
      ))}
    </div>
  );
};
