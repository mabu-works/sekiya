using System;
using System.Collections.Generic;
using System.Drawing;
using System.Windows.Forms;

namespace Sekiya
{
internal static class Program
{
[STAThread]
private static void Main()
{
ApplicationConfiguration.Initialize();
Application.Run(new MainForm());
}
}

// 🧮 Web 版 js/seat-core.js と同じ純粋ロジック（UI から切り離してある）
internal static class SeatLogic
{
public const int MinSize = 1;
public const int MaxSize = 20;

public static readonly string[] SampleNames =
{
"田中", "佐藤", "鈴木", "高橋", "伊藤", "渡辺",
"山本", "中村", "小林", "加藤", "吉田", "山田"
};

public static readonly IReadOnlyDictionary<string, string> FrontLabels =
new Dictionary<string, string>
{
{ "top", "上"}, { "bottom", "下"}, { "left", "左"}, { "right", "右"}
};

// ✂️ 1行に1人。前後の空白を取り除き、空行は無視する。同名は別々の人として残す
public static List<string> ParseNames(string text)
{
var names = new List<string>();
foreach (var line in (text?? "").Split(new[] { "\r\n", "\n"}, StringSplitOptions.None))
{
var name = line.Trim();
if (name.Length > 0) names.Add(name);
}
return names;
}

// ⚠️ 寸法の検証（NumericUpDown 前提のため範囲外チェックのみ）
public static string GridError(int rows, int cols)
{
if (rows < MinSize || rows > MaxSize || cols < MinSize || cols > MaxSize)
{
return "縦と横はそれぞれ" + MinSize + "〜" + MaxSize +
"の範囲で指定してください（現在：縦" + rows + " × 横" + cols + "）。";
}
return "";
}

// 📐 人数に合わせてグリッドを広げる計算（横を保ち、縦を増やし、必要なら横も増やす）
public static (int Rows, int Cols, string Error) ExpandGrid(int nameCount, int rows, int cols)
{
if (nameCount == 0) return (rows, cols, "先に名前を1人以上入れてください。");
int r = rows;
int c = cols > MaxSize? MaxSize: cols;
r = (int)Math.Ceiling(nameCount / (double)c);
if (r > MaxSize)
{
r = MaxSize;
c = (int)Math.Ceiling(nameCount / (double)r);
}
if (r * c < nameCount)
{
return (rows, cols, "最大サイズ（縦" + MaxSize + " × 横" + MaxSize + "）でも" +
nameCount + "人は入りきりません。名前を減らしてください。");
}
return (r, c, "");
}

// 🔀 Fisher-Yates シャッフル済みの座席配列（余りは null＝空席）
public static string?[] BuildSeats(IReadOnlyList<string> names, int rows, int cols, Random random)
{
int total = rows * cols;
var shuffled = new string[names.Count];
for (int i = 0; i < names.Count; i++) shuffled[i] = names[i];
for (int i = shuffled.Length - 1; i > 0; i--)
{
int j = random.Next(i + 1);
(shuffled[i], shuffled[j]) = (shuffled[j], shuffled[i]);
}
var seats = new string?[total];
for (int i = 0; i < total; i++)
{
seats[i] = i < shuffled.Length? shuffled[i]: null;
}
return seats;
}

// 📋 結果コピー用テキスト（Web 版 resultText と同じ形式）
public static string ResultText(string?[] seats, int rows, int cols, string front)
{
var lines = new List<string>();

string RowLine(int r)
{
var cells = new List<string>();
for (int c = 0; c < cols; c++)
{
cells.Add(seats[r * cols + c]?? "（空席）");
}
return string.Join(" ｜ ", cells);
}

if (front == "top") lines.Add("");
if (front == "left" || front == "right")
{
lines.Add("");
}
for (int r = 0; r < rows; r++)
{
string line = RowLine(r);
if (front == "left") line = "前｜ " + line;
if (front == "right") line = line + " ｜前";
lines.Add(line);
}
if (front == "bottom") lines.Add("");
return string.Join(Environment.NewLine, lines);
}
}

internal sealed class MainForm: Form
{
// 🎨 Web 版と同じ配色
private static readonly Color Bg = Color.FromArgb(10, 15, 28);
private static readonly Color Surface = Color.FromArgb(17, 26, 44);
private static readonly Color Surface2 = Color.FromArgb(24, 38, 66);
private static readonly Color TextColor = Color.FromArgb(236, 241, 248);
private static readonly Color Muted = Color.FromArgb(157, 177, 199);
private static readonly Color Accent = Color.FromArgb(106, 141, 255);
private static readonly Color TileBg = Color.FromArgb(15, 23, 41);
private static readonly Color BannerBg = Color.FromArgb(19, 78, 74);
private static readonly Color BannerText = Color.FromArgb(236, 253, 245);
private static readonly Color EmptyText = Color.FromArgb(138, 151, 168);

private readonly NumericUpDown rowsNum;
private readonly NumericUpDown colsNum;
private readonly Label seatCountLabel;
private readonly Label gridMsg;
private readonly TextBox namesBox;
private readonly Label nameCountLabel;
private readonly RadioButton frontTop;
private readonly RadioButton frontBottom;
private readonly RadioButton frontLeft;
private readonly RadioButton frontRight;
private readonly Button reshuffleBtn;
private readonly Button copyBtn;
private readonly Label shuffleMsg;
private readonly Panel seatArea;
private readonly Random random = new Random();

private string?[]? lastSeats; // 直近の結果（名前または null、行優先）
private int lastRows;
private int lastCols;

public MainForm()
{
Text = "せきや for Windows｜席替え・座席シャッフル";
ClientSize = new Size(1080, 724);
MinimumSize = new Size(1096, 763);
BackColor = Bg;
ForeColor = TextColor;
Font = new Font("Yu Gothic UI", 10F);

Controls.Add(new Label
{
Text = "せきや｜席替え・座席シャッフル",
Font = new Font("Yu Gothic UI", 15F, FontStyle.Bold),
ForeColor = TextColor,
Location = new Point(16, 12),
AutoSize = true
});
Controls.Add(MakeMutedLabel("座席グリッド", 16, 56));

Controls.Add(MakeMutedLabel("縦", 16, 86));
rowsNum = new NumericUpDown
{
Minimum = SeatLogic.MinSize, Maximum = SeatLogic.MaxSize, Value = 6,
Location = new Point(52, 82), Width = 70,
BackColor = Surface, ForeColor = TextColor
};
rowsNum.ValueChanged += (s, e) => UpdateSeatCount();
Controls.Add(rowsNum);

Controls.Add(MakeMutedLabel("横", 140, 86));
colsNum = new NumericUpDown
{
Minimum = SeatLogic.MinSize, Maximum = SeatLogic.MaxSize, Value = 6,
Location = new Point(176, 82), Width = 70,
BackColor = Surface, ForeColor = TextColor
};
colsNum.ValueChanged += (s, e) => UpdateSeatCount();
Controls.Add(colsNum);

seatCountLabel = new Label
{
Text = "座席数：36席",
ForeColor = TextColor,
Location = new Point(16, 116),
AutoSize = true
};
Controls.Add(seatCountLabel);

gridMsg = new Label
{
Text = "",
ForeColor = Muted,
Location = new Point(16, 142),
Size = new Size(292, 46)
};
Controls.Add(gridMsg);

Controls.Add(MakeMutedLabel("前（黒板）の向き", 16, 194));
frontTop = MakeFrontRadio("上", true, 16, 222);
frontBottom = MakeFrontRadio("下", false, 88, 222);
frontLeft = MakeFrontRadio("左", false, 160, 222);
frontRight = MakeFrontRadio("右", false, 232, 222);
Controls.Add(frontTop);
Controls.Add(frontBottom);
Controls.Add(frontLeft);
Controls.Add(frontRight);

Controls.Add(MakeMutedLabel("名前リスト（1行に1人）", 16, 262));
nameCountLabel = new Label
{
Text = "0人",
ForeColor = Muted,
Location = new Point(240, 262),
AutoSize = true
};
Controls.Add(nameCountLabel);

namesBox = new TextBox
{
Multiline = true,
ScrollBars = ScrollBars.Vertical,
Location = new Point(16, 288),
Size = new Size(292, 200),
BackColor = Surface,
ForeColor = TextColor,
Font = new Font("Yu Gothic UI", 10F),
BorderStyle = BorderStyle.FixedSingle
};
namesBox.TextChanged += (s, e) => { UpdateNameCount(); UpdateSeatCount();};
Controls.Add(namesBox);

var sampleBtn = MakeSubButton("サンプル", 16, 498, 142);
sampleBtn.Click += (s, e) => { namesBox.Text = string.Join(Environment.NewLine, SeatLogic.SampleNames);};
Controls.Add(sampleBtn);

var clearBtn = MakeSubButton("クリア", 166, 498, 142);
clearBtn.Click += (s, e) => { namesBox.Text = ""; namesBox.Focus();};
Controls.Add(clearBtn);

var expandBtn = MakeSubButton("人数に合わせて座席を広げる", 16, 542, 292);
expandBtn.Click += (s, e) => ExpandGrid();
Controls.Add(expandBtn);

Controls.Add(new Label
{
Text = "同名は別々の人として扱います（同姓同名対応）。空席は自動で入ります。",
ForeColor = Muted,
Location = new Point(16, 592),
Size = new Size(292, 60)
});

var shuffleBtn = new Button
{
Text = "席替え（シャッフル）",
Font = new Font("Yu Gothic UI", 11F, FontStyle.Bold),
BackColor = Accent,
ForeColor = Color.White,
FlatStyle = FlatStyle.Flat,
Location = new Point(332, 52),
Size = new Size(200, 44)
};
shuffleBtn.FlatAppearance.BorderSize = 0;
shuffleBtn.Click += (s, e) => ShuffleSeats();
Controls.Add(shuffleBtn);

reshuffleBtn = MakeSubButton("もう一度", 544, 52, 130);
reshuffleBtn.Size = new Size(130, 44);
reshuffleBtn.Enabled = false;
reshuffleBtn.Click += (s, e) => ShuffleSeats();
Controls.Add(reshuffleBtn);

copyBtn = MakeSubButton("結果をコピー", 686, 52, 150);
copyBtn.Size = new Size(150, 44);
copyBtn.Enabled = false;
copyBtn.Click += (s, e) => CopyResult();
Controls.Add(copyBtn);

shuffleMsg = new Label
{
Text = "",
ForeColor = Muted,
Location = new Point(332, 106),
Size = new Size(732, 26)
};
Controls.Add(shuffleMsg);

seatArea = new Panel
{
Location = new Point(332, 140),
Size = new Size(732, 548),
BackColor = Surface,
BorderStyle = BorderStyle.FixedSingle
};
Controls.Add(seatArea);

UpdateNameCount();
UpdateSeatCount();
}

private Label MakeMutedLabel(string text, int x, int y)
{
return new Label { Text = text, ForeColor = Muted, Location = new Point(x, y), AutoSize = true};
}

private RadioButton MakeFrontRadio(string text, bool initial, int x, int y)
{
var radio = new RadioButton
{
Text = text,
Checked = initial,
ForeColor = TextColor,
Location = new Point(x, y),
AutoSize = true
};
radio.CheckedChanged += (s, e) =>
{
if (radio.Checked && lastSeats!= null) RenderSeats();
};
return radio;
}

private Button MakeSubButton(string text, int x, int y, int w)
{
return new Button
{
Text = text,
BackColor = Surface2,
ForeColor = TextColor,
FlatStyle = FlatStyle.Flat,
Location = new Point(x, y),
Size = new Size(w, 36)
};
}

private string SelectedFront()
{
if (frontBottom.Checked) return "bottom";
if (frontLeft.Checked) return "left";
if (frontRight.Checked) return "right";
return "top";
}

private List<string> CurrentNames() => SeatLogic.ParseNames(namesBox.Text);

private void UpdateNameCount()
{
nameCountLabel.Text = CurrentNames().Count + "人";
}

private void UpdateSeatCount()
{
var err = SeatLogic.GridError((int)rowsNum.Value, (int)colsNum.Value);
if (err.Length > 0)
{
seatCountLabel.Text = "座席数：―";
gridMsg.Text = err;
return;
}
int total = (int)rowsNum.Value * (int)colsNum.Value;
seatCountLabel.Text = "座席数：" + total + "席";
int names = CurrentNames().Count;
gridMsg.Text = names > total
? "名前（" + names + "人）が座席数（" + total + "席）を超えています。「人数に合わせて座席を広げる」を押すか、縦・横を増やしてください。"
: "";
}

private void ExpandGrid()
{
var result = SeatLogic.ExpandGrid(CurrentNames().Count, (int)rowsNum.Value, (int)colsNum.Value);
if (result.Error.Length > 0)
{
gridMsg.Text = result.Error;
return;
}
rowsNum.Value = result.Rows;
colsNum.Value = result.Cols;
UpdateSeatCount();
gridMsg.Text = "座席を縦" + result.Rows + " × 横" + result.Cols +
"（" + result.Rows * result.Cols + "席）に広げました。";
}

private void ShuffleSeats()
{
var err = SeatLogic.GridError((int)rowsNum.Value, (int)colsNum.Value);
if (err.Length > 0)
{
shuffleMsg.Text = err;
return;
}
int rows = (int)rowsNum.Value;
int cols = (int)colsNum.Value;
int total = rows * cols;
var names = CurrentNames();
if (names.Count == 0)
{
shuffleMsg.Text = "名前を1人以上入れてください。";
return;
}
if (names.Count > total)
{
shuffleMsg.Text = "名前（" + names.Count + "人）が座席数（" + total + "席＝縦" + rows + " × 横" + cols +
"）を超えています。縦・横を増やすか、「人数に合わせて座席を広げる」を押してください。";
return;
}

lastSeats = SeatLogic.BuildSeats(names, rows, cols, random);
lastRows = rows;
lastCols = cols;
shuffleMsg.Text = names.Count + "人を" + total + "席に配置しました（空席" + (total - names.Count) + "席）。";
reshuffleBtn.Enabled = true;
copyBtn.Enabled = true;
RenderSeats();
}

private void RenderSeats()
{
if (lastSeats == null) return;
int rows = lastRows;
int cols = lastCols;
string front = SelectedFront();

seatArea.Controls.Clear();

var banner = new Label
{
Text = "前（黒板）",
BackColor = BannerBg,
ForeColor = BannerText,
TextAlign = ContentAlignment.MiddleCenter,
Font = new Font("Yu Gothic UI", 11F, FontStyle.Bold)
};

var grid = new TableLayoutPanel
{
RowCount = rows,
ColumnCount = cols,
BackColor = Surface,
CellBorderStyle = TableLayoutPanelCellBorderStyle.None
};
for (int c = 0; c < cols; c++) grid.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 100f / cols));
for (int r = 0; r < rows; r++) grid.RowStyles.Add(new RowStyle(SizeType.Percent, 100f / rows));

for (int r = 0; r < rows; r++)
{
for (int c = 0; c < cols; c++)
{
var name = lastSeats[r * cols + c];
grid.Controls.Add(new Label
{
Text = name?? "空席",
ForeColor = name == null? EmptyText: TextColor,
BackColor = TileBg,
TextAlign = ContentAlignment.MiddleCenter,
Dock = DockStyle.Fill,
Margin = new Padding(3),
Font = new Font("Yu Gothic UI", 10F)
}, c, r);
}
}

int w = seatArea.ClientSize.Width;
int h = seatArea.ClientSize.Height;
const int bannerSize = 36;
switch (front)
{
case "bottom":
grid.Location = new Point(8, 8);
grid.Size = new Size(w - 16, h - bannerSize - 24);
banner.Location = new Point(8, h - bannerSize - 8);
banner.Size = new Size(w - 16, bannerSize);
break;
case "left":
banner.Text = "前\n（\n黒\n板\n）";
banner.Location = new Point(8, 8);
banner.Size = new Size(bannerSize, h - 16);
grid.Location = new Point(bannerSize + 16, 8);
grid.Size = new Size(w - bannerSize - 32, h - 16);
break;
case "right":
banner.Text = "前\n（\n黒\n板\n）";
banner.Location = new Point(w - bannerSize - 8, 8);
banner.Size = new Size(bannerSize, h - 16);
grid.Location = new Point(8, 8);
grid.Size = new Size(w - bannerSize - 32, h - 16);
break;
default: // top
banner.Location = new Point(8, 8);
banner.Size = new Size(w - 16, bannerSize);
grid.Location = new Point(8, bannerSize + 16);
grid.Size = new Size(w - 16, h - bannerSize - 24);
break;
}
seatArea.Controls.Add(grid);
seatArea.Controls.Add(banner);
}

private void CopyResult()
{
if (lastSeats == null) return;
Clipboard.SetText(SeatLogic.ResultText(lastSeats, lastRows, lastCols, SelectedFront()));
shuffleMsg.Text = "結果をコピーしました。";
}
}
}
