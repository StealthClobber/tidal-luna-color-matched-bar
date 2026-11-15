import { LunaNumberSetting, LunaSelectItem, LunaSelectSetting, LunaSettings, LunaSwitchSetting } from "@luna/ui";
import React from "react";

import { applyBarHeight, BAR_HEIGHT, storage, update, type Edge } from ".";
import { COLORS, LABELS, type ColorName } from "./swatches";

type Change = { target: { value: unknown } };

const colorItems = (withNone: boolean) => [
	...(withNone
		? [
				<LunaSelectItem key="None" value="None">
					None
				</LunaSelectItem>,
			]
		: []),
	...COLORS.map((name) => (
		<LunaSelectItem key={name} value={name}>
			{LABELS[name]}
		</LunaSelectItem>
	)),
];

export const Settings = () => {
	const [mode, setMode] = React.useState(storage.mode);
	const [color1, setColor1] = React.useState(storage.color1);
	const [color2, setColor2] = React.useState(storage.color2);
	const [color3, setColor3] = React.useState(storage.color3);
	const [gradientFill, setGradientFill] = React.useState(storage.gradientFill);
	const [rotate, setRotate] = React.useState(storage.rotate);
	const [barHeight, setBarHeight] = React.useState(storage.barHeight);
	const [edge, setEdge] = React.useState(storage.edge);
	const [edgeColor, setEdgeColor] = React.useState(storage.edgeColor);
	const gradient = mode === "gradient";
	const blur = mode === "blur";

	return (
		<LunaSettings>
			<LunaNumberSetting
				title="Bar height"
				desc={`Thickness of the progress bar in pixels (TIDAL's own is ${BAR_HEIGHT.tidal}, up to ${BAR_HEIGHT.max})`}
				min={BAR_HEIGHT.min}
				max={BAR_HEIGHT.max}
				value={barHeight}
				onNumber={(height: number) => {
					setBarHeight((storage.barHeight = height));
					applyBarHeight();
				}}
			/>
			<LunaSelectSetting
				title="Edge"
				desc="A light edge around the bar"
				value={edge}
				onChange={(event: Change) => {
					setEdge((storage.edge = event.target.value as Edge));
					update();
				}}
			>
				<LunaSelectItem value="none">None</LunaSelectItem>
				<LunaSelectItem value="outline">Outline</LunaSelectItem>
				<LunaSelectItem value="glow">Glow</LunaSelectItem>
				<LunaSelectItem value="both">Outline and glow</LunaSelectItem>
			</LunaSelectSetting>
			{edge !== "none" && (
				<LunaSelectSetting
					title="Edge color"
					desc="A lighter version of the bar's colors, or white"
					value={edgeColor}
					onChange={(event: Change) => {
						setEdgeColor((storage.edgeColor = event.target.value as typeof storage.edgeColor));
						update();
					}}
				>
					<LunaSelectItem value="lighter">Lighter bar color</LunaSelectItem>
					<LunaSelectItem value="white">White</LunaSelectItem>
				</LunaSelectSetting>
			)}
			<LunaSelectSetting
				title="Style"
				desc="One color, a gradient of chosen colors, or the cover blurred across the bar like TIDAL's Blur player background"
				value={mode}
				onChange={(event: Change) => {
					setMode((storage.mode = event.target.value as typeof storage.mode));
					update();
				}}
			>
				<LunaSelectItem value="single">Single color</LunaSelectItem>
				<LunaSelectItem value="gradient">Gradient</LunaSelectItem>
				<LunaSelectItem value="blur">Blur</LunaSelectItem>
			</LunaSelectSetting>
			<LunaSelectSetting
				title={gradient ? "Start color" : blur ? "Fallback color" : "Album color"}
				desc={
					blur
						? "Used instead of the blur when a cover is almost entirely black."
						: "Which color from the album cover to use. If a cover doesn't have it, the next one in the list is used."
				}
				value={color1}
				onChange={(event: Change) => {
					setColor1((storage.color1 = event.target.value as ColorName));
					update();
				}}
			>
				{colorItems(false)}
			</LunaSelectSetting>
			{blur && (
				<LunaSwitchSetting
					title="Rotate"
					desc="Slowly turn the blur while a song plays, like TIDAL's blurred player background"
					checked={rotate}
					onChange={(_: unknown, checked: boolean) => {
						setRotate((storage.rotate = checked));
						update();
					}}
				/>
			)}
			{(gradient || blur) && (
				<LunaSelectSetting
					title="Gradient fill"
					desc="Whether the whole gradient fits the played part, or spans the full bar and is revealed as the song plays"
					value={gradientFill}
					onChange={(event: Change) => {
						setGradientFill((storage.gradientFill = event.target.value as typeof storage.gradientFill));
						update();
					}}
				>
					<LunaSelectItem value="stretch">Grow with progress</LunaSelectItem>
					<LunaSelectItem value="fixed">Fixed across the bar</LunaSelectItem>
				</LunaSelectSetting>
			)}
			{gradient && (
				<LunaSelectSetting
					title="Second color"
					desc="Middle color with three colors, end color with two"
					value={color2}
					onChange={(event: Change) => {
						setColor2((storage.color2 = event.target.value as ColorName));
						update();
					}}
				>
					{colorItems(false)}
				</LunaSelectSetting>
			)}
			{gradient && (
				<LunaSelectSetting
					title="Third color"
					desc="Optional end color"
					value={color3}
					onChange={(event: Change) => {
						setColor3((storage.color3 = event.target.value as ColorName | "None"));
						update();
					}}
				>
					{colorItems(true)}
				</LunaSelectSetting>
			)}
		</LunaSettings>
	);
};
