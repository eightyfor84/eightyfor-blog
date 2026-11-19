---
title: 概率论知识点
date: 2026-08-01T22:32:17.035Z
updatedAt: 2026-08-11T21:33:25.363Z
tags: statistics
author: 
aiGenerated: true
status: draft
font: sans
---

### **第1章：概率论基础**

本章介绍了概率论的基本概念、公理、计数方法、条件概率和独立性，为后续学习统计推断奠定了基础。

#### **1.1 基本概念**
*   **样本空间 (Sample Space, S)**：一个实验所有可能结果的集合。
*   **事件 (Event, A)**：样本空间的子集，即某些结果的集合。
*   **事件运算**：
    *   **补集 (Aᶜ)**：事件A不发生。
    *   **交集 (A∩B)**：事件A和B同时发生。
    *   **并集 (A∪B)**：事件A或B至少一个发生。
    *   **德摩根定律 (De Morgan's Laws)**：
        *   $(A \cup B)^c = A^c \cap B^c$
        *   $(A \cap B)^c = A^c \cup B^c$

#### **1.2 概率的定义与公理**
*   **古典概型（朴素定义）**：适用于有限且等可能的样本空间。事件A的概率为：
    $$P(A) = \frac{|A|}{|S|}$$
    其中`|A|`表示事件A包含的结果数。
*   **概率公理 (Axioms of Probability)**：
    1.  **非负性**：对于任何事件A，$P(A) \ge 0$。
    2.  **归一性**：$P(S) = 1$。
    3.  **可列可加性**：对于可数个互不相容的事件 $A_1, A_2, \dots$，有 $P(\cup_{i=1}^\infty A_i) = \sum_{i=1}^\infty P(A_i)$。
*   **重要推论**：
    *   $P(\emptyset) = 0$
    *   $P(A^c) = 1 - P(A)$
    *   若 $B \subseteq A$，则 $P(B) \le P(A)$。
*   **容斥原理 (Inclusion-Exclusion Principle)**：
    $$P(A \cup B) = P(A) + P(B) - P(A \cap B)$$

#### **1.3 计数法则**
*   **乘法原则 (Multiplication Rule)**：如果一个实验由k个步骤组成，每个步骤分别有$n_1, n_2, \dots, n_k$种方式，则总共有$n_1 \times n_2 \times \dots \times n_k$种结果。
*   **排列 (Permutation)**：从n个不同元素中有序地抽取k个，结果数为：
    $$P(n, k) = \frac{n!}{(n-k)!}$$
*   **组合 (Combination)**：从n个不同元素中无序地抽取k个，结果数为：
    $$C(n, k) = \binom{n}{k} = \frac{n!}{k!(n-k)!}$$

#### **1.4 条件概率与独立性**
*   **条件概率 (Conditional Probability)**：在事件B发生的条件下，事件A发生的概率。
    $$P(A|B) = \frac{P(A \cap B)}{P(B)}, \quad P(B) > 0$$
*   **乘法法则 (Multiplication Rule)**：
    $$P(A \cap B) = P(A|B)P(B) = P(B|A)P(A)$$
*   **全概率公式 (Law of Total Probability, LOTP)**：若 $A_1, \dots, A_n$ 是样本空间的一个划分，则：
    $$P(B) = \sum_{i=1}^n P(B|A_i)P(A_i)$$
*   **贝叶斯定理 (Bayes' Rule)**：
    $$P(A_i|B) = \frac{P(B|A_i)P(A_i)}{P(B)} = \frac{P(B|A_i)P(A_i)}{\sum_{j=1}^n P(B|A_j)P(A_j)}$$
*   **独立性 (Independence)**：事件A和B独立，当且仅当：
    $$P(A \cap B) = P(A)P(B)$$
    等价地，$P(A|B) = P(A)$ 或 $P(B|A) = P(B)$。

---

### **第2章：单变量随机变量及其分布**

本章引入了随机变量的概念，并详细介绍了离散型和连续型随机变量的概率分布、数字特征及其重要的衍生分布。

#### **2.1 随机变量 (Random Variable, r.v.)**
*   **定义**：从样本空间S到实数集$\mathbb{R}$的函数。

#### **2.2 离散型随机变量**
*   **概率质量函数 (PMF)**：$p_X(x) = P(X=x)$。
*   **累积分布函数 (CDF)**：$F_X(x) = P(X \le x)$。
*   **常见离散分布**：
    *   **伯努利分布 (Bernoulli)**：$X \sim \text{Bern}(p)$，PMF: $P(X=1)=p, P(X=0)=1-p$。
    *   **二项分布 (Binomial)**：$X \sim \text{Bin}(n, p)$，PMF: $P(X=k) = \binom{n}{k}p^k(1-p)^{n-k}$。是n个独立Bern(p)变量之和。
    *   **几何分布 (Geometric)**：$X \sim \text{Geom}(p)$，PMF: $P(X=k) = (1-p)^k p, k=0,1,\dots$。具有**无记忆性**：$P(X \ge m+n | X \ge m) = P(X \ge n)$。
    *   **负二项分布 (Negative Binomial)**：$X \sim \text{NBin}(r, p)$，PMF: $P(X=n) = \binom{n+r-1}{r-1}p^r(1-p)^n$。是r个独立Geom(p)变量之和。
    *   **泊松分布 (Poisson)**：$X \sim \text{Pois}(\lambda)$，PMF: $P(X=k) = e^{-\lambda}\lambda^k/k!$。可作为二项分布的近似（$n$大，$p$小，$np=\lambda$）。

#### **2.3 连续型随机变量**
*   **概率密度函数 (PDF)**：$f_X(x) = F'_X(x)$。
*   **累积分布函数 (CDF)**：$F_X(x) = \int_{-\infty}^x f_X(t) dt$。
*   **常见连续分布**：
    *   **均匀分布 (Uniform)**：$X \sim \text{Unif}(a, b)$，PDF: $f(x) = 1/(b-a), a < x < b$。
    *   **正态分布 (Normal)**：$X \sim \mathcal{N}(\mu, \sigma^2)$，PDF: $f(x) = \frac{1}{\sqrt{2\pi}\sigma} \exp\left(-\frac{(x-\mu)^2}{2\sigma^2}\right)$。标准正态分布 $\mathcal{N}(0, 1)$ 的CDF记为 $\Phi(z)$。
    *   **指数分布 (Exponential)**：$X \sim \text{Expo}(\lambda)$，PDF: $f(x) = \lambda e^{-\lambda x}, x > 0$。同样具有**无记忆性**。是泊松过程中首次事件发生的时间。
    *   **伽马分布 (Gamma)**：$X \sim \text{Gamma}(a, \lambda)$，PDF: $f(x) = \frac{\lambda^a}{\Gamma(a)} x^{a-1}e^{-\lambda x}$。包含Expo(λ) = Gamma(1, λ)。是n个独立Expo(λ)变量之和。
    *   **贝塔分布 (Beta)**：$X \sim \text{Beta}(a, b)$，PDF: $f(x) = \frac{1}{B(a, b)} x^{a-1}(1-x)^{b-1}$。Beta(1,1) = Unif(0,1)。

#### **2.4 随机变量的函数**
*   **分布函数法（通用）**：$F_Y(y) = P(g(X) \le y)$，然后求导得 $f_Y(y)$。
*   **变量变换法（单调函数）**：若 $Y = g(X)$ 严格单调，则：
    $$f_Y(y) = f_X(g^{-1}(y)) \left| \frac{d}{dy} g^{-1}(y) \right|$$

#### **2.5 期望、方差与矩**
*   **期望 (Expectation)**：$E(X) = \int x f(x) dx$ (连续) 或 $\sum x p(x)$ (离散)。
*   **LOTUS (Law of the Unconscious Statistician)**：
    $$E(g(X)) = \int g(x) f(x) dx \quad (\text{或} \sum g(x)p(x))$$
*   **方差 (Variance)**：$\text{Var}(X) = E[(X-\mu)^2] = E(X^2) - [E(X)]^2$。标准差 $SD(X) = \sqrt{\text{Var}(X)}$。
*   **矩母函数 (MGF)**：$M_X(t) = E(e^{tX})$。性质：
    1.  $E(X^n) = M_X^{(n)}(0)$ (用MGF求矩)。
    2.  MGF唯一决定分布。
    3.  $M_{X+Y}(t) = M_X(t)M_Y(t)$ (独立变量之和的MGF)。

---

### **第3章：多元随机变量及其分布**

本章将随机变量的概念扩展到多维，重点研究两个或多个随机变量之间的联合行为、关系以及条件分布。

#### **3.1 联合、边缘与条件分布**
*   **联合CDF**：$F_{X,Y}(x,y) = P(X \le x, Y \le y)$。
*   **离散型**：
    *   **联合PMF**：$p_{X,Y}(x,y) = P(X=x, Y=y)$。
    *   **边缘PMF**：$p_X(x) = \sum_y p_{X,Y}(x,y)$。
    *   **条件PMF**：$p_{Y|X}(y|x) = \frac{p_{X,Y}(x,y)}{p_X(x)}$。
*   **连续型**：
    *   **联合PDF**：$f_{X,Y}(x,y) = \frac{\partial^2}{\partial x \partial y} F_{X,Y}(x,y)$。
    *   **边缘PDF**：$f_X(x) = \int_{-\infty}^\infty f_{X,Y}(x,y) dy$。
    *   **条件PDF**：$f_{Y|X}(y|x) = \frac{f_{X,Y}(x,y)}{f_X(x)}$。
*   **混合型（一离散一连续）**：使用“混合”的PDF/PMF组合。

#### **3.2 独立性**
*   **定义**：$X$和$Y$独立，当且仅当 $F_{X,Y}(x,y) = F_X(x)F_Y(y)$。对于连续型，等价于 $f_{X,Y}(x,y) = f_X(x)f_Y(y)$。

#### **3.3 协方差与相关性**
*   **协方差 (Covariance)**：衡量两个变量线性相关程度。
    $$\text{Cov}(X, Y) = E[(X - E(X))(Y - E(Y))] = E(XY) - E(X)E(Y)$$
    *   **性质**：$\text{Var}(X \pm Y) = \text{Var}(X) + \text{Var}(Y) \pm 2\text{Cov}(X,Y)$。
*   **相关系数 (Correlation)**：标准化的协方差，无量纲。
    $$\rho = \text{Corr}(X, Y) = \frac{\text{Cov}(X, Y)}{\sqrt{\text{Var}(X)\text{Var}(Y)}}$$
    *   **性质**：$-1 \le \rho \le 1$。若 $Y = a + bX$，则 $\rho = \pm 1$。
*   **独立性与相关性**：独立 => 不相关，但反之不成立。

#### **3.4 条件期望与条件方差**
*   **条件期望 (Conditional Expectation)**：
    $$E(Y|X=x) = \int y f_{Y|X}(y|x) dy \quad (\text{或} \sum y p_{Y|X}(y|x))$$
    记 $E(Y|X)$ 为 $x$ 的函数 $g(x)$，它是一个随机变量。
*   **重期望法则 (Law of Iterated Expectations, LIE)**：
    $$E[E(Y|X)] = E(Y)$$
*   **条件方差 (Conditional Variance)**：
    $$\text{Var}(Y|X=x) = E[(Y-E(Y|X=x))^2|X=x]$$
*   **全方差法则 (Law of Total Variance)**：
    $$\text{Var}(Y) = E[\text{Var}(Y|X)] + \text{Var}(E(Y|X))$$

#### **3.5 二元与多元正态分布**
*   **定义**：一个随机向量服从多元正态分布（MVN），如果其所有线性组合都服从正态分布。
*   **性质**：
    1.  边缘分布和条件分布仍为正态。
    2.  任何线性变换仍为MVN。
    3.  **独立性等价于不相关性**：在MVN中，不相关 <=> 独立。

---

### **第4章：大数定律与中心极限定理**

本章介绍统计学中最重要的两个极限定理，它们奠定了统计推断的理论基础。

#### **4.1 大数定律 (Law of Large Numbers, LLN)**
*   **弱大数定律 (WLLN)**：样本均值 $\bar{X}_n$ 依概率收敛于总体均值 $\mu$。
    $$\bar{X}_n \xrightarrow{p} \mu$$
    形式化表述：$\forall \epsilon > 0$，$\lim_{n \to \infty} P(|\bar{X}_n - \mu| > \epsilon) = 0$。
*   **强大数定律 (SLLN)**：$\bar{X}_n$ 以概率1收敛于 $\mu$。即 $P(\lim_{n \to \infty} \bar{X}_n = \mu) = 1$。

#### **4.2 尾概率不等式**
*   **马尔可夫不等式 (Markov's Inequality)**：
    $$P(|X| \ge a) \le \frac{E(|X|)}{a}, \quad a > 0$$
*   **切比雪夫不等式 (Chebyshev's Inequality)**：
    $$P(|X - E(X)| \ge a) \le \frac{\text{Var}(X)}{a^2}, \quad a > 0$$

#### **4.3 中心极限定理 (Central Limit Theorem, CLT)**
*   **定理**：无论总体分布是什么（只要均值和方差存在），当样本量 $n$ 足够大时，样本均值的标准化形式近似服从标准正态分布。
    $$Z = \frac{\bar{X}_n - \mu}{\sigma / \sqrt{n}} \xrightarrow{d} \mathcal{N}(0, 1)$$
*   **推论**：$\bar{X}_n \approx \mathcal{N}(\mu, \sigma^2/n)$ 且 $\sum X_i \approx \mathcal{N}(n\mu, n\sigma^2)$。

---

### **第5章：点估计**

本章讨论如何利用样本数据对总体参数进行单一数值的估计，并评估这些估计量的好坏。

#### **5.1 基本概念**
*   **参数 (Parameter)**：描述总体特征的数值，如均值 $\mu$，方差 $\sigma^2$。
*   **统计量 (Statistic)**：样本数据的函数，如样本均值 $\bar{X}_n$。
*   **点估计 (Point Estimate)**：用统计量的观测值作为参数的猜测值。相应的统计量称为**点估计量 (Point Estimator)**。

#### **5.2 估计量的评价标准**
*   **无偏性 (Unbiasedness)**：估计量的期望等于参数真值。$E(\hat{\theta}) = \theta$。偏差 $Bias(\hat{\theta}) = E(\hat{\theta}) - \theta$。
    *   例：$E(S_n^2) = \sigma^2$，但 $E\left(\frac{1}{n}\sum (X_i - \bar{X})^2\right) = \frac{n-1}{n}\sigma^2$。
*   **有效性 (Efficiency)**：用方差衡量，方差越小越有效。$\text{Var}(\hat{\theta})$ 的平方根称为**标准误 (Standard Error)**。
*   **均方误差 (Mean Squared Error, MSE)**：综合考虑了偏差和方差。
    $$MSE(\hat{\theta}) = E[(\hat{\theta} - \theta)^2] = \text{Var}(\hat{\theta}) + [Bias(\hat{\theta})]^2$$
*   **相合性 (Consistency)**：随着样本量 $n \to \infty$，估计量 $\hat{\theta}_n$ 依概率收敛于 $\theta$。

#### **5.3 构造估计量的方法**
*   **矩估计 (Method of Moments, MoM)**：
    1.  计算前 $d$ 个总体矩 $E(X^k)$。
    2.  计算前 $d$ 个样本矩 $\frac{1}{n}\sum X_i^k$。
    3.  令总体矩等于样本矩，解出参数。
*   **极大似然估计 (Maximum Likelihood Estimation, MLE)**：
    1.  写出似然函数 $L(\theta; \mathbf{x}) = \prod_{i=1}^n f(x_i; \theta)$。
    2.  最大化似然函数（或其对数）得到估计值 $\hat{\theta}_{MLE}$。
*   **MLE的性质**：
    1.  **不变性 (Invariance)**：若 $\hat{\theta}$ 是 $\theta$ 的MLE，则 $h(\hat{\theta})$ 是 $h(\theta)$ 的MLE。
    2.  **渐近正态性**：$\sqrt{n}(\hat{\theta}_{MLE} - \theta) \xrightarrow{d} \mathcal{N}(0, \frac{1}{I(\theta)})$，其中 $I(\theta)$ 是**Fisher信息量**。
*   **克拉美-罗下界 (Cramer-Rao Lower Bound)**：对于任意无偏估计量 $\hat{\theta}$，其方差的下界为 $\text{Var}(\hat{\theta}) \ge \frac{1}{nI(\theta)}$。达到该下界的估计量称为**有效估计量**。

---

### **第6章：置信区间**

本章介绍区间估计，它弥补了点估计无法给出估计精度的缺陷。

#### **6.1 基本概念**
*   **定义**：一个随机区间 $[L(\mathbf{X}), U(\mathbf{X})]$，它以预先指定的概率 $1-\alpha$ 覆盖参数的真值 $\theta$。
    $$P(L(\mathbf{X}) \le \theta \le U(\mathbf{X})) = 1-\alpha$$
*   **置信水平 (Confidence Level)**：$1-\alpha$，表示该区间覆盖真值的长期频率（对方法而言，非对特定区间）。

#### **6.2 枢轴量法 (Pivotal Quantity Method)**
*   **核心步骤**：
    1.  寻找一个枢轴量 $h(\mathbf{X}, \theta)$，其分布不依赖于任何未知参数。
    2.  找到常数 $a, b$ 使得 $P(a \le h(\mathbf{X}, \theta) \le b) = 1-\alpha$。
    3.  解不等式得到 $\theta$ 的置信区间。

#### **6.3 正态总体参数的置信区间**
*   **均值 $\mu$ 的CI（方差 $\sigma^2$ 已知）**：使用 $Z = \frac{\bar{X}-\mu}{\sigma/\sqrt{n}} \sim \mathcal{N}(0,1)$。
    $$\bar{X}_n \pm z_{\alpha/2} \frac{\sigma}{\sqrt{n}}$$
*   **均值 $\mu$ 的CI（方差 $\sigma^2$ 未知）**：使用 $T = \frac{\bar{X}-\mu}{S/\sqrt{n}} \sim t_{n-1}$。
    $$\bar{X}_n \pm t_{\alpha/2, n-1} \frac{S_n}{\sqrt{n}}$$
*   **方差 $\sigma^2$ 的CI**：使用 $\frac{(n-1)S^2}{\sigma^2} \sim \chi^2_{n-1}$。
    $$\left[ \frac{(n-1)S_n^2}{\chi^2_{\alpha/2, n-1}}, \frac{(n-1)S_n^2}{\chi^2_{1-\alpha/2, n-1}} \right]$$

#### **6.4 大样本与Bootstrap置信区间**
*   **非正态总体的均值CI**：当 $n$ 很大时，由CLT，$\bar{X}_n \pm z_{\alpha/2} S_n/\sqrt{n}$ 近似有效。
*   **总体比例 $p$ 的CI**：
    $$\hat{p} \pm z_{\alpha/2} \sqrt{\frac{\hat{p}(1-\hat{p})}{n}} \quad (\text{Wald区间})$$
*   **Bootstrap**：一种重抽样方法，用于估计统计量的抽样分布（特别是当理论分布未知时）。
    *   **Bootstrap标准误**：重复从原始样本中有放回地抽取B个样本，计算B个估计值 $\hat{\theta}^*_1, \dots, \hat{\theta}^*_B$，其标准差即为Bootstrap标准误。
    *   **Bootstrap t区间**：$\hat{\theta} \pm t_{\alpha/2, n-1} \times \hat{se}_{boot}$。

---

### **第7章：假设检验**

本章介绍如何根据样本数据对关于参数的某个陈述（假设）进行真伪判断。

#### **7.1 基本概念**
*   **原假设 ($H_0$)**：被检验的、通常是“无效果”或“默认”的假设。
*   **备择假设 ($H_a$)**：与原假设相对立的、研究者希望证明的假设。
*   **检验统计量 (Test Statistic)**：用于做决策的样本函数。
*   **拒绝域 (Rejection Region)**：导致拒绝 $H_0$ 的检验统计量的取值集合。

#### **7.2 两类错误**
*   **第I类错误 (Type I Error)**：当 $H_0$ 为真时拒绝它。其概率记为 $\alpha$，即**显著性水平 (Significance Level)**。
*   **第II类错误 (Type II Error)**：当 $H_0$ 为假时未能拒绝它。其概率记为 $\beta$。
*   **势 (Power)**：当 $H_0$ 为假时正确拒绝它的概率。$\text{Power} = 1 - \beta$。

#### **7.3 决策方法**
*   **拒绝域法**：给定 $\alpha$，根据检验统计量的**零分布（$H_0$成立时的分布）** 确定临界值，形成拒绝域。
*   **P值法 (P-value)**：在 $H_0$ 成立的假设下，观察到当前样本或更极端样本的概率。P值越小，拒绝 $H_0$ 的证据越强。若 $P\text{-value} \le \alpha$，则拒绝 $H_0$。

#### **7.4 常见假设检验**
*   **单样本z检验**：总体方差 $\sigma^2$ 已知，检验 $\mu$。
    *   检验统计量：$Z = \frac{\bar{X}-\mu_0}{\sigma/\sqrt{n}} \sim \mathcal{N}(0,1)$（$H_0$下）。
    *   例：$H_a: \mu > \mu_0$ 的拒绝域为 $Z \ge z_\alpha$。
*   **单样本t检验**：总体方差 $\sigma^2$ 未知，检验 $\mu$。
    *   检验统计量：$T = \frac{\bar{X}-\mu_0}{S/\sqrt{n}} \sim t_{n-1}$（$H_0$下）。
    *   是大样本下非正态总体的稳健检验。
*   **单样本方差检验**：检验 $\sigma^2$。
    *   检验统计量：$\chi^2 = \frac{(n-1)S^2}{\sigma_0^2} \sim \chi^2_{n-1}$（$H_0$下）。
*   **总体比例检验**：
    *   检验统计量：$Z = \frac{\hat{p} - p_0}{\sqrt{p_0(1-p_0)/n}} \approx \mathcal{N}(0,1)$（$n$大时）。
*   **两样本t检验**：比较两个独立正态总体的均值 $\mu_1$ 和 $\mu_2$。
    *   检验统计量：$T = \frac{(\bar{X}-\bar{Y}) - \Delta_0}{\sqrt{S_1^2/m + S_2^2/n}} \approx t_\nu$。
*   **配对t检验**：比较两个相关样本（如前后测量）的均值。
    *   思路：计算差值 $D_i = X_i - Y_i$，然后进行单样本t检验。
*   **ANOVA (方差分析)**：比较 $I \ge 2$ 个总体的均值是否全相等。
    *   $H_0: \mu_1 = \mu_2 = \dots = \mu_I$
    *   **检验统计量**：$F = \frac{\text{SSTr}/(I-1)}{\text{SSE}/(n-I)} \sim F_{I-1, n-I}$（$H_0$下）。
    *   **关键公式**：$\text{SST} = \text{SSTr} + \text{SSE}$
        *   $\text{SSTr}$：组间平方和，衡量各组的均值差异。
        *   $\text{SSE}$：组内平方和，衡量随机误差。

---

### **第8章：线性回归**

本章介绍如何建立和推断变量之间的线性关系，是最常用的统计模型之一。

#### **8.1 简单线性回归模型 (SLR)**
*   **模型形式**：$Y_i = \beta_0 + \beta_1 x_i + \epsilon_i$，其中 $\epsilon_i \sim \mathcal{N}(0, \sigma^2)$。
*   **解释**：$\beta_0$ 是截距，$\beta_1$ 是斜率。$E(Y|x) = \beta_0 + \beta_1 x$。
*   **假设**：线性性、独立性、正态性、方差齐性。

#### **8.2 最小二乘估计 (OLS)**
*   **原理**：最小化残差平方和 $g(b_0, b_1) = \sum_{i=1}^n [y_i - (b_0 + b_1 x_i)]^2$。
*   **估计公式**：
    $$\hat{\beta}_1 = \frac{\sum (x_i - \bar{x})(y_i - \bar{y})}{\sum (x_i - \bar{x})^2} = \frac{S_{xy}}{S_{xx}}, \quad \hat{\beta}_0 = \bar{y} - \hat{\beta}_1 \bar{x}$$
*   **误差方差估计**：
    *   **残差**：$e_i = y_i - \hat{y}_i = y_i - (\hat{\beta}_0 + \hat{\beta}_1 x_i)$。
    *   **残差平方和 (SSE)**：$\text{SSE} = \sum e_i^2$。
    *   **$\sigma^2$ 的无偏估计**：$\hat{\sigma}^2 = \text{MSE} = \text{SSE}/(n-2)$。

#### **8.3 模型评估**
*   **判定系数 ($R^2$)**：
    $$R^2 = 1 - \frac{\text{SSE}}{\text{SST}}$$
    其中 $\text{SST} = \sum (y_i - \bar{y})^2$ 是总平方和。$R^2$ 表示模型解释的 $y$ 变异的比例。

#### **8.4 统计推断**
*   **斜率 $\beta_1$ 的推断**：
    *   抽样分布：$\hat{\beta}_1 \sim \mathcal{N}(\beta_1, \sigma^2/S_{xx})$。
    *   **t检验**：$H_0: \beta_1 = 0$ 的检验统计量为 $T = \frac{\hat{\beta}_1}{\sqrt{\text{MSE}/S_{xx}}} \sim t_{n-2}$。
    *   **$(1-\alpha)100\%$ 置信区间**：$\hat{\beta}_1 \pm t_{\alpha/2, n-2} \sqrt{\text{MSE}/S_{xx}}$。

#### **8.5 多元线性回归 (MLR)**
*   **模型形式**：$Y_i = \beta_0 + \beta_1 x_{i1} + \dots + \beta_k x_{ik} + \epsilon_i$。
*   **系数解释**：$\beta_j$ 表示在控制其他变量不变的情况下，$x_j$ 每增加一个单位，$Y$ 的平均变化量。
*   **推断**：与SLR类似，但自由度变为 $n-(k+1)$。
    *   **单个系数检验**：$T = \frac{\hat{\beta}_j}{SE(\hat{\beta}_j)} \sim t_{n-k-1}$。
    *   **整体F检验**：$H_0: \beta_1 = \dots = \beta_k = 0$，检验统计量 $F = \frac{\text{MSR}}{\text{MSE}} \sim F_{k, n-k-1}$。
*   **调整 $R^2$ (Adjusted $R^2$)**：对添加变量进行惩罚，防止过拟合。
    $$R^2_{adj} = 1 - \frac{\text{MSE}}{\text{MST}} = 1 - \frac{\text{SSE}/(n-k-1)}{\text{SST}/(n-1)}$$
