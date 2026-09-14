# V.I.E.W — Prototype Video Production Package
### Next-Gen Border Defense Intelligence Console · "Million-Dollar" Product Launch Film

This directory contains the complete creative and technical production package for the official prototype and product reveal video of **V.I.E.W** (*Virtual Intelligence & Early Warning System*), engineered for **Smart India Hackathon 26187** (Ministry of Defence / BSF Border Surveillance).

---

## 📁 Package Contents

| File / Folder | Description |
| :--- | :--- |
| [`01_GEMINI_VEO_PROMPTS.md`](file:///c:/Users/mizan/OneDrive/Desktop/Border-Survelliance_AI/video_prototype/01_GEMINI_VEO_PROMPTS.md) | **Production-ready prompts for Google Gemini Veo** (Veo 2 / Veo 3) with exact lens settings, camera moves, lighting, durations, and audio cues for all 7 scenes. |
| [`02_STORYBOARD_AND_VOICEOVER_SCRIPT.md`](file:///c:/Users/mizan/OneDrive/Desktop/Border-Survelliance_AI/video_prototype/02_STORYBOARD_AND_VOICEOVER_SCRIPT.md) | **Complete 70-second launch film screenplay**, including shot-by-shot visual descriptions, word-for-word voiceover script, audio design stems, and transition notes. |
| [`03_RECORDLY_UI_ANIMATION_SPEC.md`](file:///c:/Users/mizan/OneDrive/Desktop/Border-Survelliance_AI/video_prototype/03_RECORDLY_UI_ANIMATION_SPEC.md) | **"Recordly" / Screen Studio motion spec** detailing smooth 3D isometric perspectives, cubic-bezier easing curves, and dynamic zoom coordinates into the real V.I.E.W frontend code. |
| [`reference_images/`](file:///c:/Users/mizan/OneDrive/Desktop/Border-Survelliance_AI/video_prototype/reference_images/) | **6 Ultra-High-Resolution (16:9 Landscape) Reference Images** generated specifically to serve as first-frame and style anchors for Gemini Veo video generation. |

---

## 🖼️ Reference Image Gallery

### 1. The Frontier Outpost (Dawn Sweep)
![01_border_outpost_dawn.jpg](file:///c:/Users/mizan/OneDrive/Desktop/Border-Survelliance_AI/video_prototype/reference_images/01_border_outpost_dawn.jpg)
*Establishing aerial shot of the fortified military border base camp, surveillance towers, radar domes, and zero-line razor wire fence at sunrise.*

---

### 2. Drone HUD Lock on Infiltrator (Target Classification)
![02_drone_hud_thermal_lock.jpg](file:///c:/Users/mizan/OneDrive/Desktop/Border-Survelliance_AI/video_prototype/reference_images/02_drone_hud_thermal_lock.jpg)
*Airborne tactical surveillance drone zooming 24x into the zero-line fence, locking onto the infiltrator with glowing red/yellow bounding box and real-time telemetry.*

---

### 3. Recordly 3D UI Zoom — Ingestion & Breach Alert
![03_view_ui_recordly_zoom.jpg](file:///c:/Users/mizan/OneDrive/Desktop/Border-Survelliance_AI/video_prototype/reference_images/03_view_ui_recordly_zoom.jpg)
*Sleek 3D angled close-up of the V.I.E.W console displaying the captured snapshot, YOLO confidence score (88%), bold breach alert banner, and QRT dispatch button.*

---

### 4. Joint Operations Command (JOC Command Wall)
![04_tactical_command_center.jpg](file:///c:/Users/mizan/OneDrive/Desktop/Border-Survelliance_AI/video_prototype/reference_images/04_tactical_command_center.jpg)
*Wide cinematic view inside the military operations room with operators monitoring the multi-camera grid, 3D border topography, and alert streams.*

---

### 5. Ground Interception on the Zero-Line
![05_border_tactical_interception.jpg](file:///c:/Users/mizan/OneDrive/Desktop/Border-Survelliance_AI/video_prototype/reference_images/05_border_tactical_interception.jpg)
*Armored QRT tactical vehicles and border patrol troops arriving at the fence line at night, illuminated by drone spotlights and laser target designation.*

---

### 6. The "Million-Dollar" Product Keynote Finale
![06_view_product_hero_closing.jpg](file:///c:/Users/mizan/OneDrive/Desktop/Border-Survelliance_AI/video_prototype/reference_images/06_view_product_hero_closing.jpg)
*Transparent borderless OLED tactical display in a high-end dark keynote presentation studio revealing the four core V.I.E.W capabilities with gold typography.*

---

## 🎬 How to Generate the Video with Gemini Veo

1. **Step 1: Upload Reference Image as First Frame**
   - In Google Vertex AI Studio or Gemini Veo UI, select **Image-to-Video** mode.
   - Upload the corresponding reference image from `reference_images/` as the starting frame.
2. **Step 2: Copy the Optimized Prompt**
   - Copy the exact prompt from [`01_GEMINI_VEO_PROMPTS.md`](file:///c:/Users/mizan/OneDrive/Desktop/Border-Survelliance_AI/video_prototype/01_GEMINI_VEO_PROMPTS.md).
   - Set the aspect ratio to `16:9` and frame rate to `24fps` or `60fps`.
3. **Step 3: Render and Assemble**
   - Render each of the 7 scenes (5 to 6 seconds per clip).
   - Import the rendered clips into Adobe Premiere Pro, DaVinci Resolve, or Final Cut Pro.
   - Align with the voiceover and audio tracks detailed in [`02_STORYBOARD_AND_VOICEOVER_SCRIPT.md`](file:///c:/Users/mizan/OneDrive/Desktop/Border-Survelliance_AI/video_prototype/02_STORYBOARD_AND_VOICEOVER_SCRIPT.md).
   - Add the Recordly UI zoom transitions outlined in [`03_RECORDLY_UI_ANIMATION_SPEC.md`](file:///c:/Users/mizan/OneDrive/Desktop/Border-Survelliance_AI/video_prototype/03_RECORDLY_UI_ANIMATION_SPEC.md).
