import React from "react";
import type { ModalProps } from "@mantine/core";
import { Modal, Stack, Text, ScrollArea, Flex, CloseButton, Button, Textarea } from "@mantine/core";
import { CodeHighlight } from "@mantine/code-highlight";
import { toast } from "react-hot-toast";
import type { NodeData } from "../../../types/graph";
import useGraph from "../../editor/views/GraphView/stores/useGraph";
import useJson from "../../../store/useJson";
import useFile from "../../../store/useFile";

// get the value at the node's path from the full json string and stringify it
const getNodeValueString = (jsonString: string, path?: NodeData["path"]) => {
  try {
    const parsed = JSON.parse(jsonString);
    if (!path || path.length === 0) return JSON.stringify(parsed, null, 2);

    const value = (path as Array<string | number>).reduce((acc: any, seg) => {
      if (acc === undefined || acc === null) return undefined;
      return acc[seg as any];
    }, parsed as any);

    return JSON.stringify(value, null, 2);
  } catch (e) {
    // fallback to an empty object string
    return "{}";
  }
};

// return json path in the format $["customer"]
const jsonPathToString = (path?: NodeData["path"]) => {
  if (!path || path.length === 0) return "$";
  const segments = path.map(seg => (typeof seg === "number" ? seg : `"${seg}"`));
  return `$[${segments.join("][")}]`;
};

export const NodeModal = ({ opened, onClose }: ModalProps) => {
  const nodeData = useGraph(state => state.selectedNode);
  const jsonString = useJson(state => state.json);

  const [isEditing, setIsEditing] = React.useState(false);
  const [editValue, setEditValue] = React.useState<string>("{}");

  React.useEffect(() => {
    // update editValue whenever node changes and we're not editing
    if (!isEditing) {
      setEditValue(getNodeValueString(jsonString, nodeData?.path));
    }
  }, [jsonString, nodeData, isEditing]);

  const handleEdit = () => {
    setIsEditing(true);
    setEditValue(getNodeValueString(jsonString, nodeData?.path));
  };

  const handleCancel = () => {
    setIsEditing(false);
    setEditValue(getNodeValueString(jsonString, nodeData?.path));
  };

  const setValueAtPath = (obj: any, path: NodeData["path"] | undefined, value: any) => {
    if (!path || path.length === 0) return value; // replace root
    const lastIndex = (path as Array<string | number>).length - 1;
    const copy = obj;
    let cur: any = copy;
    for (let i = 0; i < lastIndex; i++) {
      const seg = path![i] as any;
      if (cur[seg] === undefined) cur[seg] = typeof path![i + 1] === "number" ? [] : {};
      cur = cur[seg];
    }
    const lastSeg = path![lastIndex] as any;
    cur[lastSeg] = value;
    return copy;
  };

  const handleDone = () => {
    try {
      const parsedNewValue = JSON.parse(editValue);
      const root = JSON.parse(jsonString);
      const newRoot = setValueAtPath(root, nodeData?.path, parsedNewValue);
      const newJsonString = JSON.stringify(newRoot, null, 2);
      useJson.getState().setJson(newJsonString);
      // update raw editor/left-panel contents store so any component reading useFile.contents updates
      try {
        useFile.getState().setContents({ contents: newJsonString, hasChanges: true, skipUpdate: true });
      } catch (err) {
        // fallback: directly set contents in case helper throws
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (useFile as any).setState({ contents: newJsonString });
      }
      setIsEditing(false);
      toast.success("Saved");
      if (onClose) onClose();
    } catch (e) {
      // invalid JSON in editValue: keep editing and do not close modal
      // show a toast so the user knows
      // eslint-disable-next-line no-console
      console.error("Invalid JSON entered:", e);
      toast.error("Invalid JSON — please fix before saving.");
    }
  };

  return (
    <Modal size="auto" opened={opened} onClose={onClose} centered withCloseButton={false}>
      <Stack pb="sm" gap="sm">
        <Stack gap="xs">
          <Flex justify="space-between" align="center">
            <Text fz="xs" fw={500}>
              Content
            </Text>
            <Flex gap="xs" align="center">
              {!isEditing ? (
                <Button size="xs" variant="default" onClick={handleEdit}>
                  Edit
                </Button>
              ) : (
                <>
                  <Button size="xs" variant="subtle" onClick={handleCancel}>
                    Cancel
                  </Button>
                  <Button size="xs" onClick={handleDone}>
                    Save
                  </Button>
                </>
              )}
              <CloseButton onClick={onClose} />
            </Flex>
          </Flex>

          <ScrollArea.Autosize mah={250} maw={600}>
            {!isEditing ? (
              <CodeHighlight
                code={getNodeValueString(jsonString, nodeData?.path)}
                miw={350}
                maw={600}
                language="json"
                withCopyButton
              />
            ) : (
              <Textarea
                minRows={6}
                value={editValue}
                onChange={ev => setEditValue(ev.currentTarget.value)}
                autosize
              />
            )}
          </ScrollArea.Autosize>
        </Stack>
        <Text fz="xs" fw={500}>
          JSON Path
        </Text>
        <ScrollArea.Autosize maw={600}>
          <CodeHighlight
            code={jsonPathToString(nodeData?.path)}
            miw={350}
            mah={250}
            language="json"
            copyLabel="Copy to clipboard"
            copiedLabel="Copied to clipboard"
            withCopyButton
          />
        </ScrollArea.Autosize>
      </Stack>
    </Modal>
  );
};
